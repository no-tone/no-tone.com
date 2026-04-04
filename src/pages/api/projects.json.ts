import type { APIContext } from 'astro';
import { simplifyRepos, type SimplifiedRepo } from '../../utils/projects-api';

const GITHUB_API_URL =
	'https://api.github.com/users/n0-tone/repos?per_page=100&sort=updated';
const CACHE_KEY_URL = 'https://projects-api.no-tone.internal/cache-v1';
const EDGE_TTL_SECONDS = 900;
const BROWSER_TTL_SECONDS = 300;
const CACHED_AT_HEADER = 'x-no-tone-cached-at';
const LAST_UPDATED_HEADER = 'x-no-tone-last-updated';
const ALLOW_METHODS = 'GET';

type Snapshot = {
	body: string;
	etag: string | null;
	lastUpdated: string;
};

const readMemorySnapshot = (): Snapshot | null => {
	return ((globalThis as any).__noToneProjectsLastSuccess ?? null) as
		| Snapshot
		| null;
};

const writeMemorySnapshot = (snapshot: Snapshot): void => {
	(globalThis as any).__noToneProjectsLastSuccess = snapshot;
};

const buildHeaders = (
	origin: string | null,
	extra?: Record<string, string>,
): Record<string, string> => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
		'X-Content-Type-Options': 'nosniff',
		'Cross-Origin-Resource-Policy': 'same-origin',
		'Referrer-Policy': 'no-referrer',
		...(extra ?? {}),
	};

	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Vary'] = 'Origin';
	}

	return headers;
};

const getLastUpdatedAt = (repos: SimplifiedRepo[]): string => {
	let newest = 0;
	for (const repo of repos) {
		const ts = repo.updatedAt ? Date.parse(repo.updatedAt) : 0;
		if (ts > newest) newest = ts;
	}
	return newest ? new Date(newest).toISOString() : '';
};

const readCachedAtMs = (res: Response): number => {
	const raw = res.headers.get(CACHED_AT_HEADER);
	if (!raw) return 0;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : 0;
};

const isFresh = (cachedAtMs: number, nowMs: number): boolean => {
	if (!cachedAtMs) return false;
	return nowMs - cachedAtMs < EDGE_TTL_SECONDS * 1000;
};

const snapshotFromResponse = async (res: Response): Promise<Snapshot> => {
	return {
		body: await res.clone().text(),
		etag: res.headers.get('ETag'),
		lastUpdated: res.headers.get(LAST_UPDATED_HEADER) ?? '',
	};
};

const toCachedResponse = (snapshot: Snapshot): Response => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		[CACHED_AT_HEADER]: String(Date.now()),
		[LAST_UPDATED_HEADER]: snapshot.lastUpdated,
	};
	if (snapshot.etag) headers['ETag'] = snapshot.etag;
	return new Response(snapshot.body, { status: 200, headers });
};

const responseFromSnapshot = (
	snapshot: Snapshot,
	origin: string | null,
	cacheState: string,
	extra?: Record<string, string>,
): Response => {
	const headers = buildHeaders(origin, {
		[LAST_UPDATED_HEADER]: snapshot.lastUpdated,
		'X-No-Tone-Cache': cacheState,
		...(extra ?? {}),
	});
	if (snapshot.etag) headers['ETag'] = snapshot.etag;
	return new Response(snapshot.body, { status: 200, headers });
};

const jsonError = (
	status: number,
	error: string,
	origin: string | null,
	extra?: Record<string, string>,
): Response => {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: buildHeaders(origin, {
			'Cache-Control': 'no-store',
			...(extra ?? {}),
		}),
	});
};

const methodNotAllowed = (origin: string | null): Response => {
	return jsonError(405, 'Method Not Allowed', origin, {
		Allow: ALLOW_METHODS,
	});
};

const forbidden = (origin: string | null): Response =>
	jsonError(403, 'Forbidden', origin);

const logProjectsApiIssue = (
	event: string,
	details: Record<string, unknown>,
): void => {
	console.warn('[projects-api]', {
		event,
		route: '/api/projects.json',
		...details,
	});
};

export async function GET(context: APIContext): Promise<Response> {
	const request = context.request;
	const siteOrigin = context.url.origin;
	const origin = request.headers.get('Origin');
	const secFetchSite = request.headers.get('Sec-Fetch-Site');
	const forceRevalidate = request.headers.get('x-no-tone-revalidate') === '1';
	const nowMs = Date.now();

	if (origin && origin !== siteOrigin) {
		return forbidden(null);
	}

	if (secFetchSite === 'cross-site') {
		return forbidden(origin ?? null);
	}

	const cache = (globalThis as any).caches?.default as Cache | undefined;
	const cacheKey = new Request(CACHE_KEY_URL);
	const cachedResponse = cache ? ((await cache.match(cacheKey)) ?? undefined) : undefined;
	let cachedSnapshot: Snapshot | null = null;

	if (cachedResponse) {
		cachedSnapshot = await snapshotFromResponse(cachedResponse);
		if (!forceRevalidate && isFresh(readCachedAtMs(cachedResponse), nowMs)) {
			return responseFromSnapshot(cachedSnapshot, origin ?? null, 'hit');
		}
	}

	const upstreamStartedAt = Date.now();
	try {
		const upstream = await fetch(GITHUB_API_URL, {
			headers: {
				'User-Agent': 'no-tone-site',
				'Accept': 'application/vnd.github.mercy-preview+json',
				...(cachedSnapshot?.etag
					? { 'If-None-Match': cachedSnapshot.etag }
					: {}),
			},
		});

		if (upstream.status === 304 && cachedSnapshot) {
			if (cache) {
				try {
					await cache.put(cacheKey, toCachedResponse(cachedSnapshot).clone());
				} catch {
					// ignore cache errors
				}
			}
			writeMemorySnapshot(cachedSnapshot);
			return responseFromSnapshot(cachedSnapshot, origin ?? null, 'revalidated', {
				'Server-Timing': `github;dur=${Date.now() - upstreamStartedAt}`,
			});
		}

		if (!upstream.ok) {
			throw new Error(`upstream-status-${upstream.status}`);
		}

		const raw = await upstream.json();
		const simplified = simplifyRepos(raw);
		const snapshot: Snapshot = {
			body: JSON.stringify(simplified),
			etag: upstream.headers.get('ETag'),
			lastUpdated: getLastUpdatedAt(simplified),
		};

		writeMemorySnapshot(snapshot);
		if (cache) {
			try {
				await cache.put(cacheKey, toCachedResponse(snapshot).clone());
			} catch {
				// ignore cache errors
			}
		}

		return responseFromSnapshot(
			snapshot,
			origin ?? null,
			cachedSnapshot ? 'updated' : 'miss',
			{
				'Server-Timing': `github;dur=${Date.now() - upstreamStartedAt}`,
			},
		);
	} catch (error) {
		logProjectsApiIssue('upstream_failed', {
			latencyMs: Date.now() - upstreamStartedAt,
			hasCachedSnapshot: !!cachedSnapshot,
			error: error instanceof Error ? error.message : 'unknown-error',
		});

		if (cachedSnapshot) {
			return responseFromSnapshot(cachedSnapshot, origin ?? null, 'stale', {
				Warning: '110 - "Response is stale"',
			});
		}

		const memorySnapshot = readMemorySnapshot();
		if (memorySnapshot) {
			return responseFromSnapshot(memorySnapshot, origin ?? null, 'memory-stale', {
				Warning: '110 - "Response is stale"',
			});
		}

		return jsonError(503, 'Projects temporarily unavailable', origin ?? null, {
			'Retry-After': String(BROWSER_TTL_SECONDS),
		});
	}
}

const methodNotAllowedHandler = (context: APIContext): Response =>
	methodNotAllowed(context.request.headers.get('Origin'));

export const POST = methodNotAllowedHandler;
export const PUT = methodNotAllowedHandler;
export const PATCH = methodNotAllowedHandler;
export const DELETE = methodNotAllowedHandler;
export const HEAD = methodNotAllowedHandler;
export const OPTIONS = methodNotAllowedHandler;

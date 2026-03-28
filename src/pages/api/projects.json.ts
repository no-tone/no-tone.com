import type { APIContext } from 'astro';
import { getClientIp } from '../../utils/request';
import {
	buildRateLimitCacheRequest,
	getRateLimitResetAt,
	parseRateLimitCount,
	simplifyRepos,
	type SimplifiedRepo,
} from '../../utils/projects-api';

const GITHUB_API_URL =
	'https://api.github.com/users/n0-tone/repos?per_page=100&sort=updated';
const EDGE_TTL_SECONDS = 900; // 15 minutes at the edge
const BROWSER_TTL_SECONDS = 300; // 5 minutes in the browser
const CACHED_AT_HEADER = 'x-no-tone-cached-at';
const LAST_UPDATED_HEADER = 'x-no-tone-last-updated';
const RATE_LIMIT_MAX = 90;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ALLOW_METHODS = 'GET';

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitState = {
	limit: number;
	remaining: number;
	resetAt: number;
	blocked: boolean;
};

const rateLimitStore: Map<string, RateLimitEntry> =
	(globalThis as any).__noToneProjectRateLimit ??
	((globalThis as any).__noToneProjectRateLimit = new Map<string, RateLimitEntry>());

const buildHeaders = (origin: string | null) => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
		'X-Content-Type-Options': 'nosniff',
		'Cross-Origin-Resource-Policy': 'same-origin',
		'Referrer-Policy': 'no-referrer',
	};

	// Only allow JS running on your own origin to read this response
	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Vary'] = 'Origin';
	}

	return headers;
};

const readRateLimitFromMemory = (
	request: Request,
	nowMs: number,
): RateLimitState => {
	const ip = getClientIp(request);
	const current = rateLimitStore.get(ip);
	if (!current || current.resetAt <= nowMs) {
		const next = { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS };
		rateLimitStore.set(ip, next);
		return {
			limit: RATE_LIMIT_MAX,
			remaining: RATE_LIMIT_MAX - 1,
			resetAt: next.resetAt,
			blocked: false,
		};
	}
	current.count += 1;
	const blocked = current.count > RATE_LIMIT_MAX;
	const remaining = blocked ? 0 : Math.max(0, RATE_LIMIT_MAX - current.count);
	return {
		limit: RATE_LIMIT_MAX,
		remaining,
		resetAt: current.resetAt,
		blocked,
	};
};

const readRateLimit = async (
	request: Request,
	nowMs: number,
	cache: Cache | undefined,
): Promise<RateLimitState> => {
	if (!cache) {
		return readRateLimitFromMemory(request, nowMs);
	}

	try {
		const clientKey = getClientIp(request);
		const cacheKey = buildRateLimitCacheRequest(
			clientKey,
			nowMs,
			RATE_LIMIT_WINDOW_MS,
		);
		const existing = await cache.match(cacheKey);
		const currentCount = existing
			? parseRateLimitCount(await existing.text())
			: 0;
		const nextCount = currentCount + 1;
		const resetAt = getRateLimitResetAt(nowMs, RATE_LIMIT_WINDOW_MS);
		const ttlSeconds = Math.max(1, Math.ceil((resetAt - nowMs) / 1000));

		await cache.put(
			cacheKey,
			new Response(String(nextCount), {
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': `max-age=${ttlSeconds}`,
				},
			}),
		);

		const blocked = nextCount > RATE_LIMIT_MAX;
		return {
			limit: RATE_LIMIT_MAX,
			remaining: blocked ? 0 : Math.max(0, RATE_LIMIT_MAX - nextCount),
			resetAt,
			blocked,
		};
	} catch {
		return readRateLimitFromMemory(request, nowMs);
	}
};

const attachRateLimitHeaders = (
	headers: Record<string, string>,
	rate: RateLimitState,
): void => {
	headers['X-RateLimit-Limit'] = String(rate.limit);
	headers['X-RateLimit-Remaining'] = String(rate.remaining);
	headers['X-RateLimit-Reset'] = String(Math.ceil(rate.resetAt / 1000));
};

const buildHeadersWithRate = (
	origin: string | null,
	rate: RateLimitState,
	extra?: Record<string, string>,
): Record<string, string> => {
	const headers = { ...buildHeaders(origin), ...(extra ?? {}) };
	attachRateLimitHeaders(headers, rate);
	return headers;
};

const jsonError = (
	status: number,
	error: string,
	origin: string | null,
	rate: RateLimitState,
	extra?: Record<string, string>,
): Response => {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: buildHeadersWithRate(origin, rate, extra),
	});
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

const responseFromCached = (
	cached: Response,
	origin: string | null,
	rate?: RateLimitState,
	extra?: Record<string, string>,
): Response => {
	const etag = cached.headers.get('ETag');
	const lastUpdated = cached.headers.get(LAST_UPDATED_HEADER);
	const headers = rate
		? buildHeadersWithRate(origin, rate, extra)
		: { ...buildHeaders(origin), ...(extra ?? {}) };
	if (etag) headers['ETag'] = etag;
	if (lastUpdated) headers[LAST_UPDATED_HEADER] = lastUpdated;
	return new Response(cached.body, { status: 200, headers });
};

const methodNotAllowed = (
	origin: string | null,
	rate: RateLimitState,
): Response => {
	return jsonError(405, 'Method Not Allowed', origin, rate, { Allow: ALLOW_METHODS });
};

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

const toCachedResponse = (
	body: string,
	etag: string | null,
	lastUpdated: string,
): Response => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		[CACHED_AT_HEADER]: String(Date.now()),
		[LAST_UPDATED_HEADER]: lastUpdated,
	};
	if (etag) headers['ETag'] = etag;
	return new Response(body, { status: 200, headers });
};

export async function GET(context: APIContext): Promise<Response> {
	const request = context.request;
	const siteOrigin = context.url.origin;
	const origin = request.headers.get('Origin');
	const secFetchSite = request.headers.get('Sec-Fetch-Site');
	const nowMs = Date.now();

	// Basic origin check: allow same-origin requests and non-CORS requests (like server-to-server or direct curl)
	if (origin && origin !== siteOrigin) {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: buildHeaders(null),
		});
	}

	if (secFetchSite && secFetchSite === 'cross-site') {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: buildHeaders(origin ?? null),
		});
	}

	const cache = (globalThis as any).caches?.default as Cache | undefined;
	const cacheKey = new Request(GITHUB_API_URL);
	let cached: Response | undefined;
	const waitUntil = (context.locals as any)?.cfContext?.waitUntil as
		| ((promise: Promise<unknown>) => void)
		| undefined;

	// Try edge cache first
	if (cache) {
		cached = (await cache.match(cacheKey)) ?? undefined;
		if (cached && isFresh(readCachedAtMs(cached), nowMs)) {
			return responseFromCached(cached, origin ?? null, undefined, {
				'X-No-Tone-Cache': 'hit',
			});
		}
	}

	const rate = await readRateLimit(request, nowMs, cache);
	if (rate.blocked) {
		return jsonError(429, 'Too Many Requests', origin ?? null, rate, {
			'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - nowMs) / 1000))),
		});
	}

	if (cache && cached) {
		if (cached) {
			const cachedRes = cached;
			const cachedEtag = cached.headers.get('ETag');
			const revalidate = async () => {
				const upstreamStartedAt = Date.now();
				try {
					const upstream = await fetch(GITHUB_API_URL, {
						headers: {
							'User-Agent': 'no-tone-site',
							'Accept': 'application/vnd.github.mercy-preview+json',
							...(cachedEtag ? { 'If-None-Match': cachedEtag } : {}),
						},
					});

					if (upstream.status === 304) {
						const body = await cachedRes.clone().text();
						const lastUpdated = cachedRes.headers.get(LAST_UPDATED_HEADER) ?? '';
						await cache.put(
							cacheKey,
							toCachedResponse(body, cachedEtag ?? null, lastUpdated),
						);
						return;
					}

					if (!upstream.ok) {
						logProjectsApiIssue('background_revalidate_failed', {
							status: upstream.status,
							latencyMs: Date.now() - upstreamStartedAt,
						});
						return;
					}

					const raw = await upstream.json();
					const simplified = simplifyRepos(raw);
					const body = JSON.stringify(simplified);
					const etag = upstream.headers.get('ETag');
					await cache.put(
						cacheKey,
						toCachedResponse(body, etag, getLastUpdatedAt(simplified)),
					);
				} catch (error) {
					logProjectsApiIssue('background_revalidate_threw', {
						latencyMs: Date.now() - upstreamStartedAt,
						error: error instanceof Error ? error.message : 'unknown-error',
					});
				}
			};

			// Stale-while-revalidate: serve cached immediately and refresh in background
			if (waitUntil) waitUntil(revalidate());
			return responseFromCached(cached, origin ?? null, rate, {
				'X-No-Tone-Cache': 'stale',
				Warning: '110 - "Response is stale"',
			});
		}
	}

	// Fetch from GitHub (optionally revalidate with ETag)
	const cachedEtag = cached?.headers.get('ETag');
	const upstreamStartedAt = Date.now();
	let upstream: Response;
	try {
		upstream = await fetch(GITHUB_API_URL, {
			headers: {
				// GitHub requires a User-Agent
				'User-Agent': 'no-tone-site',
				'Accept': 'application/vnd.github.mercy-preview+json', // Needed for topics
				...(cachedEtag ? { 'If-None-Match': cachedEtag } : {}),
			},
		});
	} catch (error) {
		logProjectsApiIssue('upstream_threw', {
			latencyMs: Date.now() - upstreamStartedAt,
			hasCachedResponse: !!cached,
			error: error instanceof Error ? error.message : 'unknown-error',
		});
		if (cached) {
			return responseFromCached(cached, origin ?? null, rate, {
				'X-No-Tone-Cache': 'stale',
				Warning: '110 - "Response is stale"',
			});
		}
		return jsonError(
			503,
			'Projects are temporarily unavailable',
			origin ?? null,
			rate,
			{
				'Retry-After': String(BROWSER_TTL_SECONDS),
			},
		);
	}

	if (upstream.status === 304 && cached) {
		// Not modified: reuse cached body but bump cached timestamp
		const body = await cached.clone().text();
		const lastUpdated = cached.headers.get(LAST_UPDATED_HEADER) ?? '';
		const newCached = toCachedResponse(body, cachedEtag ?? null, lastUpdated);
		if (cache) {
			try {
				await cache.put(cacheKey, newCached.clone());
			} catch {
				// ignore cache errors
			}
		}
		const headers = buildHeadersWithRate(origin ?? null, rate, {
			[LAST_UPDATED_HEADER]: lastUpdated,
			'Server-Timing': `github;dur=${Date.now() - upstreamStartedAt}`,
			'X-No-Tone-Cache': 'revalidated',
		});
		return new Response(body, { status: 200, headers });
	}

	if (!upstream.ok) {
		logProjectsApiIssue('upstream_failed', {
			status: upstream.status,
			latencyMs: Date.now() - upstreamStartedAt,
			hasCachedResponse: !!cached,
		});
		// If we have anything cached (even stale), serve it.
		if (cached) {
			return responseFromCached(cached, origin ?? null, rate, {
				'X-No-Tone-Cache': 'stale',
				Warning: '110 - "Response is stale"',
			});
		}
		return jsonError(
			503,
			'Projects are temporarily unavailable',
			origin ?? null,
			rate,
			{
				'Retry-After': String(BROWSER_TTL_SECONDS),
				'X-Upstream-Status': String(upstream.status),
			},
		);
	}

	const raw = await upstream.json();
	const simplified = simplifyRepos(raw);
	const body = JSON.stringify(simplified);
	const lastUpdated = getLastUpdatedAt(simplified);

	// Store in edge cache for subsequent requests (store ETag + cached-at)
	const etag = upstream.headers.get('ETag');
	if (cache) {
		try {
			await cache.put(
				cacheKey,
				toCachedResponse(body, etag, lastUpdated).clone(),
			);
		} catch {
			// ignore cache errors
		}
	}

	const headers = buildHeadersWithRate(origin ?? null, rate, {
		[LAST_UPDATED_HEADER]: lastUpdated,
		'Server-Timing': `github;dur=${Date.now() - upstreamStartedAt}`,
		'X-No-Tone-Cache': 'miss',
	});
	return new Response(body, { status: 200, headers });
}

const methodNotAllowedHandler = (context: APIContext): Response =>
	methodNotAllowed(context.request.headers.get('Origin'), {
		limit: RATE_LIMIT_MAX,
		remaining: RATE_LIMIT_MAX,
		resetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
		blocked: false,
	});

export const POST = methodNotAllowedHandler;
export const PUT = methodNotAllowedHandler;
export const PATCH = methodNotAllowedHandler;
export const DELETE = methodNotAllowedHandler;
export const HEAD = methodNotAllowedHandler;
export const OPTIONS = methodNotAllowedHandler;

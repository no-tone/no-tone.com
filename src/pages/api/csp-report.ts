import type { APIContext } from 'astro';
import { summarizeCspReport } from '../../utils/csp-report';

const noCacheHeaders = {
	'Cache-Control': 'no-store',
	'Content-Type': 'application/json; charset=utf-8',
	'X-Content-Type-Options': 'nosniff',
};
const ALLOW_METHODS = 'GET, POST';

const json = (body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			...noCacheHeaders,
			...(extraHeaders ?? {}),
		},
	});

export async function POST({ request, url }: APIContext): Promise<Response> {
	try {
		const body = await request.text();
		console.warn('[csp-report]', summarizeCspReport(body, url.pathname));
	} catch {
		// ignore malformed payloads
	}

	return json({ ok: true }, 202);
}

export async function GET(): Promise<Response> {
	return json({ ok: true }, 200);
}

const methodNotAllowed = (): Response => {
	return json({ error: 'Method Not Allowed' }, 405, { Allow: ALLOW_METHODS });
};

export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

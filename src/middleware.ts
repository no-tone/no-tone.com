import type { MiddlewareHandler } from 'astro';

const CSP_HEADER = 'Content-Security-Policy';
const CSP_REPORT_PATH = '/api/csp-report';
const PERMISSIONS_POLICY = [
	"camera=()",
	"microphone=()",
	"geolocation=()",
	"payment=()",
	"usb=()",
	"bluetooth=()",
	"picture-in-picture=(self)",
].join(', ');

const generateNonce = (): string => {
	try {
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		return btoa(String.fromCharCode(...bytes));
	} catch {
		return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	}
};

export const onRequest: MiddlewareHandler = async (context, next) => {
	const nonce = generateNonce();
	context.locals.cspNonce = nonce;

	const requestUrl = new URL(context.request.url);
	if (requestUrl.hostname === 'www.no-tone.com') {
		requestUrl.hostname = 'no-tone.com';
		return Response.redirect(requestUrl.toString(), 301);
	}

	const downstreamResponse = await next();
	const response = new Response(downstreamResponse.body, downstreamResponse);
	response.headers.delete('Content-Security-Policy-Report-Only');

	// Optionally prevent caching of HTML responses that contain nonces
	const contentType = response.headers.get('Content-Type') || '';
	if (contentType.startsWith('text/html')) {
		response.headers.set('Content-Type', 'text/html; charset=utf-8');
		response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate');
	}

	const isLocalDev =
		requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
	const cspReportUrl = new URL(CSP_REPORT_PATH, requestUrl).toString();

	// Baseline security headers
	const baseHeaders: Record<string, string> = {
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'no-referrer',
		'Permissions-Policy': PERMISSIONS_POLICY,
		'Cross-Origin-Opener-Policy': 'same-origin',
		'Cross-Origin-Resource-Policy': 'same-origin',
		'Cross-Origin-Embedder-Policy-Report-Only': 'require-corp; report-to="csp"',
		'X-Frame-Options': 'SAMEORIGIN',
		'Reporting-Endpoints': `csp="${cspReportUrl}"`,
	};
	for (const [name, value] of Object.entries(baseHeaders)) {
		response.headers.set(name, value);
	}
	if (!isLocalDev) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload',
		);
	}

	const scriptSrc = isLocalDev
		? "script-src 'self' 'unsafe-inline'"
		: `script-src 'self' 'nonce-${nonce}'`;

	const styleSrc = isLocalDev
		? "style-src 'self' 'unsafe-inline'"
		: `style-src 'self' 'nonce-${nonce}'`;

	const directives = [
		"default-src 'none'",
		scriptSrc,
		styleSrc,
		"img-src 'self' https: data:",
		"manifest-src 'self'",
		"font-src 'self' https: data:",
		"connect-src 'self' https://api.github.com",
		"frame-src 'self'",
		"frame-ancestors 'self'",
		"base-uri 'none'",
		"form-action 'self'",
		"object-src 'none'",
		`report-uri ${CSP_REPORT_PATH}`,
		'report-to csp',
	];

	// Avoid breaking local HTTP dev by upgrading.
	if (!isLocalDev) {
		directives.push('upgrade-insecure-requests');
	}

	const csp = directives.join('; ');
	const reportOnlyCsp = directives
		.filter((directive) => directive !== 'upgrade-insecure-requests')
		.join('; ');

	response.headers.set(CSP_HEADER, csp);
	response.headers.set('Content-Security-Policy-Report-Only', reportOnlyCsp);
	return response;
};

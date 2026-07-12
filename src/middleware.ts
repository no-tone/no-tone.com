import type { MiddlewareHandler } from 'astro';

const CSP_HEADER = 'Content-Security-Policy';
const CSP_REPORT_PATH = '/api/csp-report';
const DEV_HOSTNAME = 'dev.no-tone.com';
const DEV_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
const DEV_ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet';
// Only browser-recognized Permissions-Policy features (the Privacy-Sandbox /
// ad-tech tokens like browsing-topics/attribution-reporting log "Unrecognized
// feature" warnings and are dropped). Mirrors the edge Transform Rule so dev
// and prod behave the same, and grants the untitled.stream embed its features.
// Only browser-recognized Permissions-Policy features (the Privacy-Sandbox /
// ad-tech tokens like browsing-topics/attribution-reporting log "Unrecognized
// feature" warnings, so they're dropped). Mirrors the edge Transform Rule so
// dev and prod behave the same.
const PERMISSIONS_POLICY = [
	'accelerometer=()',
	'autoplay=()',
	'camera=()',
	'clipboard-read=()',
	'clipboard-write=(self)',
	'display-capture=()',
	'encrypted-media=()',
	'fullscreen=(self)',
	'geolocation=()',
	'gyroscope=()',
	'magnetometer=()',
	'microphone=()',
	'midi=()',
	'payment=()',
	'picture-in-picture=()',
	'publickey-credentials-get=()',
	'screen-wake-lock=()',
	'sync-xhr=()',
	'usb=()',
	'xr-spatial-tracking=()',
].join(', ');

const SITE_ORIGIN = 'https://no-tone.com';

// RFC 9727 API catalog describing the one public API this site exposes.
const API_CATALOG = JSON.stringify({
	linkset: [
		{
			anchor: `${SITE_ORIGIN}/api/projects.json`,
			'service-desc': [
				{ href: `${SITE_ORIGIN}/api/projects.json`, type: 'application/json' },
			],
		},
	],
});

// Machine-readable homepage for agents that send `Accept: text/markdown`.
const AGENT_MARKDOWN = [
	'# no-tone',
	'',
	'A dark, monochrome desktop-style portfolio navigated through an interactive dotted globe.',
	'',
	'## Navigate',
	'- **projects** — selected work, live from GitHub',
	'- **cv** — experience, education, skills',
	'- **about** — bio, stack, and contact',
	'- **github** — https://github.com/no-tone',
	'- **contact** — msg@no-tone.com',
	'',
	'## API',
	'- `GET /api/projects.json` — public repositories as JSON',
	'',
	'## More',
	'- Sitemap: https://no-tone.com/sitemap.xml',
	'- API catalog: https://no-tone.com/.well-known/api-catalog',
	'',
].join('\n');

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

	const isDevHost = requestUrl.hostname === DEV_HOSTNAME;
	if (isDevHost && requestUrl.pathname === '/robots.txt') {
		return new Response(DEV_ROBOTS_TXT, {
			status: 200,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-store',
				'X-Robots-Tag': DEV_ROBOTS_TAG,
			},
		});
	}

	// RFC 9727 API catalog (agent discovery for /api/projects.json).
	if (requestUrl.pathname === '/.well-known/api-catalog') {
		return new Response(API_CATALOG, {
			status: 200,
			headers: {
				'Content-Type': 'application/linkset+json; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	}

	// Markdown content negotiation: agents that ask for text/markdown get a
	// machine-readable homepage; browsers (which don't) still get the app.
	const accept = context.request.headers.get('Accept') || '';
	if (requestUrl.pathname === '/' && accept.includes('text/markdown')) {
		return new Response(AGENT_MARKDOWN, {
			status: 200,
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600',
				'X-Content-Type-Options': 'nosniff',
				Vary: 'Accept',
			},
		});
	}

	const downstreamResponse = await next();
	const response = new Response(downstreamResponse.body, downstreamResponse);
	response.headers.delete('Content-Security-Policy-Report-Only');
	if (isDevHost) {
		response.headers.set('X-Robots-Tag', DEV_ROBOTS_TAG);
	}

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
		'Cross-Origin-Embedder-Policy': 'unsafe-none',
		'X-Frame-Options': 'SAMEORIGIN',
		'Reporting-Endpoints': `csp="${cspReportUrl}"`,
		// RFC 8288 discovery links for agents.
		Link: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"; type="text/markdown"',
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

	response.headers.set(CSP_HEADER, csp);
	return response;
};

import type { APIContext } from 'astro';

const DEV_HOSTNAME = 'dev.no-tone.com';
const PROD_SITEMAP = 'https://no-tone.com/sitemap.xml';

const buildHeaders = (cacheControl: string, robotsTag?: string) => {
	const headers: Record<string, string> = {
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': cacheControl,
	};
	if (robotsTag) {
		headers['X-Robots-Tag'] = robotsTag;
	}
	return headers;
};

export function GET({ url }: APIContext): Response {
	if (url.hostname === DEV_HOSTNAME) {
		return new Response('User-agent: *\nDisallow: /\n', {
			status: 200,
			headers: buildHeaders(
				'no-store',
				'noindex, nofollow, noarchive, nosnippet',
			),
		});
	}

	return new Response(
		`User-agent: *\nAllow: /\n\nSitemap: ${PROD_SITEMAP}\n`,
		{
			status: 200,
			headers: buildHeaders('public, max-age=3600, s-maxage=3600'),
		},
	);
}

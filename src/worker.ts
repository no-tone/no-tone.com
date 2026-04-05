import { handle } from '@astrojs/cloudflare/handler';

const DEFAULT_SITE_ORIGIN = 'https://no-tone.com';

const readSiteOrigin = (env: Env): string => {
	const raw = (env as unknown as Record<string, unknown>).SITE_ORIGIN;
	if (typeof raw !== 'string' || !raw.trim()) {
		return DEFAULT_SITE_ORIGIN;
	}
	try {
		const parsed = new URL(raw);
		return parsed.origin;
	} catch {
		return DEFAULT_SITE_ORIGIN;
	}
};

const warmProjectsCache = async (
	env: Env,
	ctx: ExecutionContext,
): Promise<void> => {
	try {
		const warmupUrl = new URL('/api/projects.json', readSiteOrigin(env)).toString();
		const response = await handle(
			new Request(warmupUrl, {
				method: 'GET',
				headers: {
					accept: 'application/json',
					'x-no-tone-revalidate': '1',
					'user-agent': 'no-tone-cron-warmup',
				},
			}),
			env,
			ctx,
		);

		if (!response.ok) {
			console.warn('[projects-warmup] non-ok response', {
				status: response.status,
			});
		}
	} catch (error) {
		console.warn('[projects-warmup] failed', {
			error: error instanceof Error ? error.message : 'unknown-error',
		});
	}
};

export default {
	async fetch(request, env, ctx) {
		return handle(request, env, ctx);
	},
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(warmProjectsCache(env, ctx));
	},
} satisfies ExportedHandler<Env>;

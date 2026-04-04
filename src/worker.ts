import { handle } from '@astrojs/cloudflare/handler';

const PROJECTS_WARMUP_URL = 'https://no-tone.com/api/projects.json';

const warmProjectsCache = async (
	env: Env,
	ctx: ExecutionContext,
): Promise<void> => {
	try {
		const response = await handle(
			new Request(PROJECTS_WARMUP_URL, {
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

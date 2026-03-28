import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 8799;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const READY_PATTERNS = [
	'Ready on',
	'Listening on',
	'http://127.0.0.1',
	'localhost:',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const onceReady = (child, timeoutMs = 30000) =>
	new Promise((resolve, reject) => {
		let settled = false;
		let output = '';
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			reject(new Error(`Timed out waiting for wrangler dev.\n${output}`));
		}, timeoutMs);

		const onData = (chunk) => {
			const text = String(chunk);
			output += text;
			if (READY_PATTERNS.some((pattern) => text.includes(pattern))) {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				resolve();
			}
		};

		const onExit = (code) => {
			clearTimeout(timer);
			if (settled) return;
			settled = true;
			reject(new Error(`wrangler dev exited early with code ${code}.\n${output}`));
		};

		child.stdout.on('data', onData);
		child.stderr.on('data', onData);
		child.once('exit', onExit);
	});

const readText = async (path) => {
	const response = await fetch(new URL(path, BASE_URL));
	const text = await response.text();
	return { response, text };
};

const main = async () => {
	const child = spawn(
		'npx',
		[
			'wrangler',
			'dev',
			'--config',
			'dist/server/wrangler.json',
			'--ip',
			'127.0.0.1',
			'--port',
			String(PORT),
		],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, BROWSER: 'none', NO_COLOR: '1' },
		},
	);

	try {
		await onceReady(child);
		await sleep(500);

		const home = await readText('/');
		assert.equal(home.response.status, 200);
		assert.match(home.response.headers.get('content-type') || '', /text\/html/i);
		assert.match(home.text, /no-tone \| Software Engineer/i);

		const projects = await readText('/projects/');
		assert.equal(projects.response.status, 200);
		assert.match(projects.text, /projects\//i);

		const api = await fetch(new URL('/api/projects.json', BASE_URL));
		assert.ok([200, 503].includes(api.status));
		assert.match(api.headers.get('content-type') || '', /application\/json/i);
		JSON.parse(await api.text());

		const missing = await readText('/this-route-should-not-exist');
		assert.equal(missing.response.status, 404);
		assert.match(missing.text, /broken link/i);

		const favicon = await fetch(new URL('/favicon.ico', BASE_URL), {
			redirect: 'manual',
		});
		assert.ok([200, 301, 302].includes(favicon.status));
	} finally {
		child.kill('SIGTERM');
		await sleep(250);
		if (!child.killed) {
			child.kill('SIGKILL');
		}
	}
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});

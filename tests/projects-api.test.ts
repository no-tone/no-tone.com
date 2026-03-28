import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildRateLimitCacheRequest,
	getRateLimitResetAt,
	getRateLimitWindowStart,
	parseRateLimitCount,
	simplifyRepos,
} from '../src/utils/projects-api.ts';

test('simplifyRepos filters invalid entries and normalizes defaults', () => {
	const repos = simplifyRepos([
		null,
		{ name: 'missing-url' },
		{
			name: 'valid',
			html_url: 'https://github.com/n0-tone/valid',
			language: null,
			description: null,
			topics: ['astro', 'workers'],
			fork: true,
			archived: true,
			has_pages: true,
			stargazers_count: 4,
			forks_count: 2,
			updated_at: '2026-03-28T12:00:00.000Z',
		},
	]);

	assert.deepEqual(repos, [
		{
			name: 'valid',
			url: 'https://github.com/n0-tone/valid',
			homepage: '',
			language: 'Other',
			description: '',
			topics: ['astro', 'workers'],
			isFork: true,
			isArchived: true,
			hasPages: true,
			stars: 4,
			forks: 2,
			updatedAt: '2026-03-28T12:00:00.000Z',
		},
	]);
});

test('rate limit helpers create deterministic windows and parse counters', () => {
	assert.equal(getRateLimitWindowStart(125_000, 60_000), 120_000);
	assert.equal(getRateLimitResetAt(125_000, 60_000), 180_000);
	assert.equal(parseRateLimitCount('12'), 12);
	assert.equal(parseRateLimitCount('bad-value'), 0);

	const request = buildRateLimitCacheRequest('203.0.113.4', 125_000, 60_000);
	assert.equal(
		request.url,
		'https://rate-limit.no-tone.internal/projects/120000/203.0.113.4',
	);
});

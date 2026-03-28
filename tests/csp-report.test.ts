import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCspReport } from '../src/utils/csp-report.ts';

test('summarizeCspReport removes raw URL detail from logs', () => {
	const body = JSON.stringify({
		'csp-report': {
			disposition: 'enforce',
			'effective-directive': 'script-src',
			'violated-directive': 'script-src-elem',
			'blocked-uri': 'https://cdn.example.com/script.js?token=secret',
			'document-uri': 'https://no-tone.com/projects/?private=value',
			'source-file': 'https://no-tone.com/_astro/app.js?build=1',
		},
	});

	assert.deepEqual(summarizeCspReport(body, '/api/csp-report'), {
		path: '/api/csp-report',
		size: body.length,
		malformed: false,
		disposition: 'enforce',
		effectiveDirective: 'script-src',
		violatedDirective: 'script-src-elem',
		blockedOrigin: 'https://cdn.example.com',
		documentPath: '/projects/',
		sourceFilePath: '/_astro/app.js',
	});
});

test('summarizeCspReport marks malformed payloads', () => {
	assert.deepEqual(summarizeCspReport('not-json', '/api/csp-report'), {
		path: '/api/csp-report',
		size: 8,
		malformed: true,
		disposition: null,
		effectiveDirective: null,
		violatedDirective: null,
		blockedOrigin: null,
		documentPath: null,
		sourceFilePath: null,
	});
});

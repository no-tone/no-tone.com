import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameOriginReferrer } from '../src/utils/navigation.ts';

test('isSameOriginReferrer accepts same-origin referrers', () => {
	assert.equal(
		isSameOriginReferrer(
			'https://no-tone.com/projects/',
			'https://no-tone.com',
		),
		true,
	);
});

test('isSameOriginReferrer rejects cross-origin and invalid referrers', () => {
	assert.equal(
		isSameOriginReferrer(
			'https://example.com/projects/',
			'https://no-tone.com',
		),
		false,
	);
	assert.equal(isSameOriginReferrer('not-a-url', 'https://no-tone.com'), false);
	assert.equal(isSameOriginReferrer(null, 'https://no-tone.com'), false);
});

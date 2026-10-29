import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchTotal, packageNames, render, yesterday } from './update.mjs';

const profile = ' | [example](https://www.npmjs.com/package/example) | Description | 123 |\n<!-- npm-downloads-updated:start -->old<!-- npm-downloads-updated:end -->';
const website = '<strong data-npm-downloads="example">123 <small>downloads</small></strong>\n<!-- npm-downloads-updated:start -->old<!-- npm-downloads-updated:end -->';

test('UTC yesterday is independent of local timezone and time of day', () => {
  assert.equal(yesterday(new Date('2026-01-01T00:30:00+08:00')).toISOString(), '2025-12-30T00:00:00.000Z');
});

test('render both formats and preserve unrelated content', () => {
  for (const [target, content] of [['profile', profile], ['website', website]]) {
    assert.deepEqual(packageNames(content, target), ['example']);
    const output = render(content, target, { example: 12345 }, '2026-01-01');
    assert.ok(output.includes('12,345'));
    assert.ok(output.includes('2026-01-01'));
    assert.equal(render(output, target, { example: 12345 }, '2026-01-01'), output);
  }
  assert.ok(render(profile, 'profile', { example: 0 }, '2026-01-01').includes('| 0 |'));
});

test('fail on malformed content or missing totals', () => {
  assert.throws(() => packageNames('', 'profile'));
  assert.throws(() => packageNames(profile + profile, 'profile'));
  assert.throws(() => packageNames(profile, 'unknown'));
  assert.throws(() => render(profile, 'profile', {}, '2026-01-01'));
  assert.throws(() => render(website.split('\n')[0], 'website', { example: 1 }, '2026-01-01'));
});

test('download chunks are inclusive, contiguous and at most 365 days', async () => {
  const ranges = [];
  const request = async (url) => {
    const [start, end] = new URL(url).pathname.split('/')[3].split(':');
    ranges.push([start, end]);
    return { ok: true, json: async () => ({ package: 'example', start, end, downloads: 100 }) };
  };
  assert.equal(await fetchTotal('example', new Date('2016-01-11T00:00:00Z'), request), 200);
  assert.deepEqual(ranges, [['2015-01-10', '2016-01-09'], ['2016-01-10', '2016-01-11']]);
});

test('API failure and invalid data throw rather than retaining old statistics', async () => {
  const end = new Date('2015-01-10T00:00:00Z');
  await assert.rejects(fetchTotal('example', end, async () => ({ ok: false, status: 503 })), /HTTP 503/);
  for (const invalid of [{ downloads: -1 }, { downloads: '10' }, { end: '2015-01-09' }, { package: 'other' }]) {
    await assert.rejects(fetchTotal('example', end, async () => ({
      ok: true,
      json: async () => ({ package: 'example', start: '2015-01-10', end: '2015-01-10', downloads: 10, ...invalid }),
    })));
  }
});

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DAY = 86_400_000;
const dateString = (date) => date.toISOString().slice(0, 10);
const formats = {
  profile: {
    file: 'README.md',
    pattern: /(?<prefix>\| \[(?<name>[^\]]+)\]\(https:\/\/www\.npmjs\.com\/package\/\k<name>\) \| [^|]+ \| )[\d,]+(?<suffix> \|)/g,
    note: (date) => `Total npm downloads through ${date} (UTC). Updated via GitHub Actions.`,
  },
  website: {
    file: 'index.html',
    pattern: /(?<prefix><strong data-npm-downloads="(?<name>[^"]+)">)[\d,]+(?<suffix> <small>downloads<\/small><\/strong>)/g,
    note: (date) => `npm 累计下载量，截至 ${date}（UTC），由 GitHub Actions 更新。`,
  },
};

export function yesterday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY);
}

export async function fetchTotal(name, end, request = fetch) {
  let start = new Date('2015-01-10T00:00:00Z');
  let total = 0;
  assert.ok(end >= start, 'Download end date precedes npm statistics');
  while (start <= end) {
    const chunkEnd = new Date(Math.min(start.getTime() + 364 * DAY, end.getTime()));
    const from = dateString(start);
    const through = dateString(chunkEnd);
    const url = `https://api.npmjs.org/downloads/point/${from}:${through}/${encodeURIComponent(name)}`;
    const response = await request(url, { signal: AbortSignal.timeout(30_000) });
    assert.ok(response.ok, `npm API failed for ${name}: HTTP ${response.status}`);
    const data = await response.json();
    assert.equal(data.package, name, 'Unexpected package in npm response');
    assert.equal(data.start, from, 'Incomplete npm date range');
    assert.equal(data.end, through, 'Incomplete npm date range');
    assert.ok(Number.isSafeInteger(data.downloads) && data.downloads >= 0, 'Invalid npm download count');
    total += data.downloads;
    assert.ok(Number.isSafeInteger(total), 'Download total exceeds safe integer range');
    start = new Date(chunkEnd.getTime() + DAY);
  }
  return total;
}

export function packageNames(content, target) {
  assert.ok(Object.hasOwn(formats, target), `Unknown content target: ${target}`);
  const names = [...content.matchAll(formats[target].pattern)].map((match) => match.groups.name);
  assert.ok(names.length > 0, `No npm packages found in ${formats[target].file}`);
  assert.equal(new Set(names).size, names.length, 'Duplicate npm package entries');
  return names;
}

export function render(content, target, totals, date) {
  const names = packageNames(content, target);
  for (const name of names) {
    assert.ok(Number.isSafeInteger(totals[name]) && totals[name] >= 0, `Missing or invalid total for ${name}`);
  }
  const updated = content.replace(formats[target].pattern, (...args) => {
    const { prefix, name, suffix } = args.at(-1);
    return `${prefix}${totals[name].toLocaleString('en-US')}${suffix}`;
  });
  const note = /(?<=<!-- npm-downloads-updated:start -->)[\s\S]*?(?=<!-- npm-downloads-updated:end -->)/g;
  assert.equal([...updated.matchAll(note)].length, 1, 'Expected exactly one statistics date marker');
  return updated.replace(note, formats[target].note(date));
}

async function main(root, target) {
  assert.ok(root, 'Usage: node update.mjs <repository-directory> <profile|website>');
  assert.ok(Object.hasOwn(formats, target), `Unknown content target: ${target}`);
  const file = resolve(root, formats[target].file);
  const content = await readFile(file, 'utf8');
  const end = yesterday();
  const names = packageNames(content, target);
  const totals = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await fetchTotal(name, end)])));
  const updated = render(content, target, totals, dateString(end));
  await writeFile(file, updated);
  console.log(JSON.stringify({ through: dateString(end), totals }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv[2], process.argv[3]);
}

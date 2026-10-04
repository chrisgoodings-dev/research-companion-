import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dedupeKey, mergePair, mergeResults, titleKey } from '../../js/api/merge.js';
import { searchAll } from '../../js/api/search.js';
import { normaliseWork } from '../../js/api/openalex.js';
import { normaliseItem } from '../../js/api/crossref.js';

const oa = JSON.parse(await readFile(new URL('../fixtures/openalex-works.json', import.meta.url)));
const cr = JSON.parse(await readFile(new URL('../fixtures/crossref-works.json', import.meta.url)));
const oaPapers = oa.results.map(normaliseWork).filter(Boolean);
const crPapers = cr.message.items.map(normaliseItem).filter(Boolean);

const mk = (over) => ({ id: 'x', doi: '', title: 'T', authors: [], year: null, venue: '', abstract: '', url: '', oaUrl: '', isOa: false, oaStatus: 'closed', citedBy: 0, type: '', source: 'a', sources: ['a'], ...over });

test('titleKey ignores case and punctuation; dedupeKey prefers DOI', () => {
  assert.equal(titleKey('A Study: X!'), titleKey('a study x'));
  assert.equal(dedupeKey(mk({ doi: '10.1/a', title: 'ignored' })), 'doi:10.1/a');
  assert.equal(dedupeKey(mk({ title: 'A Study', year: 2020 })), 'title:astudy:2020');
});

test('mergePair: primary wins, gaps filled, sources unioned', () => {
  const a = mk({ doi: '10.1/a', title: 'A', abstract: '', venue: '', citedBy: 0, source: 'openalex', sources: ['openalex'], isOa: true, oaStatus: 'green' });
  const b = mk({ doi: '10.1/a', title: 'A (other)', abstract: 'Longer abstract', venue: 'Journal', citedBy: 9, authors: ['Z'], source: 'crossref', sources: ['crossref'], url: 'https://x.org' });
  const m = mergePair(a, b);
  assert.equal(m.title, 'A');
  assert.equal(m.abstract, 'Longer abstract');
  assert.equal(m.venue, 'Journal');
  assert.equal(m.citedBy, 9);
  assert.deepEqual(m.authors, ['Z']);
  assert.equal(m.isOa, true);
  assert.equal(m.oaStatus, 'green');
  assert.deepEqual(m.sources, ['openalex', 'crossref']);
  assert.equal(m.id, 'doi:10.1/a');
});

test('mergeResults: same DOI across sources becomes one paper; others kept', () => {
  const merged = mergeResults([oaPapers, crPapers]);
  const dois = merged.map((p) => p.doi);
  assert.equal(new Set(dois.filter(Boolean)).size, dois.filter(Boolean).length, 'no duplicate DOIs');
  const shared = merged.find((p) => p.doi === '10.1145/3597503.3608128');
  assert.deepEqual(shared.sources, ['openalex', 'crossref']);
  assert.equal(shared.isOa, true, 'OpenAlex open-access flag survives the merge');
  assert.equal(merged.length, 4, '3 OpenAlex + 3 Crossref - 2 shared DOIs (10.1145/... and 10.1000/xyz.123)');
});

test('mergeResults: interleaves by rank for relevance; sorts for newest and cited', () => {
  const a = [mk({ title: 'a1', year: 2001, citedBy: 1 }), mk({ title: 'a2', year: 2003, citedBy: 50 })];
  const b = [mk({ title: 'b1', year: 2010, citedBy: 5 }), mk({ title: 'b2', year: null, citedBy: 7 })];
  assert.deepEqual(mergeResults([a, b]).map((p) => p.title), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(mergeResults([a, b], 'newest').map((p) => p.title), ['b1', 'a2', 'a1', 'b2'], 'unknown year last');
  assert.deepEqual(mergeResults([a, b], 'cited').map((p) => p.title), ['a2', 'b2', 'b1', 'a1']);
  assert.deepEqual(mergeResults([]), []);
});

test('mergeResults: papers without DOI de-duplicate on title + year', () => {
  const m = mergeResults([[mk({ title: 'Same Paper!', year: 2020 })], [mk({ title: 'same paper', year: 2020 }), mk({ title: 'same paper', year: 2021 })]]);
  assert.equal(m.length, 2);
});

/* ---------- searchAll ---------- */
const route = (map) => async (url) => {
  const host = new URL(url).host;
  const h = map[host];
  if (!h) throw new Error(`unexpected host ${host}`);
  return typeof h === 'function' ? h() : new Response(JSON.stringify(h), { status: 200 });
};

test('searchAll: merges both sources and reports totals', async () => {
  const r = await searchAll({ q: 'x', sort: 'relevance' }, { fetchImpl: route({ 'api.openalex.org': oa, 'api.crossref.org': cr }) });
  assert.deepEqual(r.sourcesUsed, ['openalex', 'crossref']);
  assert.equal(r.total, 5678);
  assert.equal(r.notes.length, 0);
  const shared = r.papers.filter((p) => p.doi === '10.1145/3597503.3608128');
  assert.equal(shared.length, 1);
});

test('searchAll: one failing source gives partial results plus a note', async () => {
  const r = await searchAll({ q: 'x' }, { fetchImpl: route({ 'api.openalex.org': () => new Response('', { status: 503 }), 'api.crossref.org': cr }) });
  assert.deepEqual(r.sourcesUsed, ['crossref']);
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0].message, /OpenAlex could not be searched/);
});

test('searchAll: both failing, or empty-because-failed, throws', async () => {
  const down = () => new Response('', { status: 503 });
  await assert.rejects(searchAll({ q: 'x' }, { fetchImpl: route({ 'api.openalex.org': down, 'api.crossref.org': down }) }), (e) => e.kind === 'server');
  const empty = { meta: { count: 0 }, results: [] };
  await assert.rejects(searchAll({ q: 'x' }, { fetchImpl: route({ 'api.openalex.org': empty, 'api.crossref.org': down }) }), (e) => e.kind === 'server', 'a failure must not look like "no results"');
});

test('searchAll: genuine empty results from every source is not an error', async () => {
  const r = await searchAll({ q: 'x' }, { fetchImpl: route({ 'api.openalex.org': { meta: { count: 0 }, results: [] }, 'api.crossref.org': { message: { 'total-results': 0, items: [] } } }) });
  assert.equal(r.papers.length, 0);
});

test('searchAll: open-access filter skips Crossref and says so', async () => {
  const seen = [];
  const r = await searchAll({ q: 'x', oa: true }, { fetchImpl: async (u) => { seen.push(new URL(u).host); return new Response(JSON.stringify(oa), { status: 200 }); } });
  assert.deepEqual(seen, ['api.openalex.org']);
  assert.equal(r.notes[0].kind, 'skipped');
});

test('searchAll: honours the chosen sources and caller cancellation', async () => {
  const seen = [];
  await searchAll({ q: 'x' }, { sources: ['crossref'], fetchImpl: async (u) => { seen.push(new URL(u).host); return new Response(JSON.stringify(cr), { status: 200 }); } });
  assert.deepEqual(seen, ['api.crossref.org']);
  const c = new AbortController();
  const hang = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))));
  setTimeout(() => c.abort(), 10);
  await assert.rejects(searchAll({ q: 'x' }, { fetchImpl: hang, signal: c.signal }), (e) => e.kind === 'aborted');
});

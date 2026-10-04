import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSearchUrl, normaliseItem, searchCrossref } from '../../js/api/crossref.js';
import { decodeEntities, cleanAbstract } from '../../js/api/paper.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/crossref-works.json', import.meta.url)));
const params = (u) => new URL(u).searchParams;
const ok = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

test('buildSearchUrl: query, paging offset, sort and type filters', () => {
  const p = params(buildSearchUrl({ q: ' copilot ', page: 3, sort: 'cited' }, { mailto: '' }));
  assert.equal(p.get('query'), 'copilot');
  assert.equal(p.get('rows'), '20');
  assert.equal(p.get('offset'), '40');
  assert.equal(p.get('sort'), 'is-referenced-by-count');
  assert.equal(p.get('order'), 'desc');
  assert.equal(p.get('filter'), 'type:journal-article,type:proceedings-article');
  assert.equal(p.has('mailto'), false);
});

test('buildSearchUrl: year range filters and mailto', () => {
  const p = params(buildSearchUrl({ q: 'x', from: 2020, to: 2024 }, { mailto: 'me@example.org' }));
  assert.ok(p.get('filter').includes('from-pub-date:2020'));
  assert.ok(p.get('filter').includes('until-pub-date:2024'));
  assert.equal(p.get('mailto'), 'me@example.org');
  assert.equal(params(buildSearchUrl({ q: 'x', page: -2, sort: 'bogus' })).get('offset'), '0');
  assert.equal(params(buildSearchUrl({ q: 'x', sort: 'bogus' })).get('sort'), 'score');
});

test('entity decoding and abstract cleaning', () => {
  assert.equal(decodeEntities('Fish &amp; Chips &lt;3 &#65;&#x42; &unknown;'), 'Fish & Chips <3 AB &unknown;');
  assert.equal(decodeEntities('&#99999999;'), '&#99999999;', 'out-of-range code points are left alone');
  assert.equal(cleanAbstract('<jats:title>Abstract</jats:title><jats:p>Abstract: Hello &amp; welcome.</jats:p>'), 'Hello & welcome.');
  assert.equal(cleanAbstract(undefined), '');
  assert.equal(cleanAbstract('<jats:p>We study <jats:italic>code</jats:italic>, and tools.</jats:p>'), 'We study code, and tools.', 'inline tags do not leave stray spaces before punctuation');
  assert.equal(cleanAbstract('<jats:title>Abstract</jats:title><jats:p>Text</jats:p>'), 'Text', 'adjacent blocks are separated');
});

test('normaliseItem: full record, name-only authors, entity-decoded title', () => {
  const a = normaliseItem(fixture.message.items[0]);
  assert.equal(a.id, 'doi:10.1145/3597503.3608128');
  assert.deepEqual(a.authors, ['Albert Ziegler', 'Eirini Kalliamvakou']);
  assert.equal(a.year, 2022);
  assert.equal(a.citedBy, 230);
  assert.ok(a.abstract.startsWith('Neural code completion tools'));
  assert.deepEqual(a.sources, ['crossref']);

  const b = normaliseItem(fixture.message.items[1]);
  assert.equal(b.title, 'Security Weaknesses of Copilot & Friends: An Empirical Study');
  assert.deepEqual(b.authors, ['GitHub Research Team', 'Yujia Fu']);
  assert.equal(b.abstract, 'We analyse 435 code snippets <generated> by AI assistants.');
});

test('normaliseItem: unsafe URL replaced by DOI link; unusable records rejected', () => {
  const c = normaliseItem(fixture.message.items[2]);
  assert.equal(c.url, 'https://doi.org/10.1000/xyz.123');
  assert.equal(c.venue, '');
  assert.equal(normaliseItem(fixture.message.items[3]), null, 'no title');
  assert.equal(normaliseItem({ title: ['x'] }), null, 'no DOI');
  assert.equal(normaliseItem(null), null);
});

test('searchCrossref: success and error mapping', async () => {
  const r = await searchCrossref({ q: 'copilot' }, { fetchImpl: ok(fixture) });
  assert.equal(r.total, 5678);
  assert.equal(r.papers.length, 3);
  assert.equal(r.pages, Math.ceil(5678 / 20));
  const kind = async (fetchImpl) => { try { await searchCrossref({ q: 'x' }, { fetchImpl }); } catch (e) { return e.kind; } return 'none'; };
  assert.equal(await kind(async () => { throw new TypeError('x'); }), 'network');
  assert.equal(await kind(async () => new Response('', { status: 429 })), 'rate-limit');
  assert.equal(await kind(async () => new Response('', { status: 502 })), 'server');
  assert.equal(await kind(ok({ message: {} })), 'bad-response');
});

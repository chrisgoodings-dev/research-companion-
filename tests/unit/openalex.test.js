import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSearchUrl, reconstructAbstract, normaliseWork, searchOpenAlex, PER_PAGE } from '../../js/api/openalex.js';
import { normaliseDoi, safeUrl, stripTags, formatAuthors } from '../../js/api/paper.js';
import { ApiError } from '../../js/api/errors.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/openalex-works.json', import.meta.url)));
const params = (url) => new URL(url).searchParams;
const respond = (body, init = {}) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

test('buildSearchUrl: search, paging, sort and field selection', () => {
  const p = params(buildSearchUrl({ q: '  ai code generation ', sort: 'newest', page: 3 }, { mailto: '' }));
  assert.equal(p.get('search'), 'ai code generation');
  assert.equal(p.get('per-page'), String(PER_PAGE));
  assert.equal(p.get('page'), '3');
  assert.equal(p.get('sort'), 'publication_date:desc');
  assert.equal(p.has('filter'), false);
  assert.equal(p.has('mailto'), false);
  assert.ok(p.get('select').includes('abstract_inverted_index'));
});

test('buildSearchUrl: year range and open-access filters', () => {
  assert.equal(params(buildSearchUrl({ q: 'x', from: 2020, to: 2024 })).get('filter'), 'publication_year:2020-2024');
  assert.equal(params(buildSearchUrl({ q: 'x', from: '2020' })).get('filter'), 'publication_year:>2019');
  assert.equal(params(buildSearchUrl({ q: 'x', to: 2024 })).get('filter'), 'publication_year:<2025');
  assert.equal(params(buildSearchUrl({ q: 'x', from: 2020, oa: true })).get('filter'), 'publication_year:>2019,is_oa:true');
});

test('buildSearchUrl: ignores junk and unknown sort; includes mailto when configured', () => {
  const p = params(buildSearchUrl({ q: 'x', from: 'abc', page: -4, sort: 'nonsense' }, { mailto: 'me@example.org' }));
  assert.equal(p.has('filter'), false);
  assert.equal(p.get('page'), '1');
  assert.equal(p.get('sort'), 'relevance_score:desc');
  assert.equal(p.get('mailto'), 'me@example.org');
  assert.equal(params(buildSearchUrl({ q: 'a&b=c' })).get('search'), 'a&b=c', 'special characters are encoded, not injected');
});

test('reconstructAbstract rebuilds text from the inverted index', () => {
  assert.equal(reconstructAbstract({ Hello: [0], world: [1], again: [2] }), 'Hello world again');
  assert.equal(reconstructAbstract({ the: [0, 2], cat: [1], sat: [3] }), 'the cat the sat');
  assert.equal(reconstructAbstract(null), '');
  assert.equal(reconstructAbstract({ a: 'bad', b: [0] }), 'b');
  assert.equal(reconstructAbstract({ huge: [99999999] }), '', 'absurd positions are ignored');
  assert.equal(reconstructAbstract({ a: [0], b: [2] }), 'a b', 'gaps do not produce blank words');
});

test('paper helpers', () => {
  assert.equal(normaliseDoi('https://doi.org/10.1145/ABC.1'), '10.1145/abc.1');
  assert.equal(normaliseDoi('doi:10.1000/x1'), '10.1000/x1');
  assert.equal(normaliseDoi('not a doi'), '');
  assert.equal(safeUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(safeUrl("javascript:alert('x')"), '');
  assert.equal(safeUrl('data:text/html,hi'), '');
  assert.equal(safeUrl('/relative'), '');
  assert.equal(stripTags('A <i>nice</i>  title'), 'A nice title');
  assert.equal(formatAuthors(['A', 'B']), 'A, B');
  assert.equal(formatAuthors(['A', 'B', 'C', 'D', 'E']), 'A, B, C, D et al.');
  assert.equal(formatAuthors([]), 'Unknown authors');
});

test('normaliseWork: complete record', () => {
  const p = normaliseWork(fixture.results[0]);
  assert.equal(p.id, 'doi:10.1145/3597503.3608128');
  assert.equal(p.title, 'Productivity Assessment of Neural Code Completion');
  assert.equal(p.authors.length, 5);
  assert.equal(p.year, 2022);
  assert.ok(p.venue.startsWith('Proceedings'));
  assert.ok(p.abstract.startsWith('Neural code completion tools'));
  assert.equal(p.isOa, true);
  assert.equal(p.oaStatus, 'green');
  assert.equal(p.citedBy, 214);
  assert.equal(p.source, 'openalex');
});

test('normaliseWork: missing DOI falls back to the OpenAlex id; unsafe URLs are dropped', () => {
  const p = normaliseWork(fixture.results[1]);
  assert.equal(p.id, 'openalex:W1000000002');
  assert.equal(p.title, 'Is GitHub Copilot a Substitute for Human Pair-programming?', 'tags stripped');
  assert.equal(p.url, '', 'javascript: landing page rejected');
  assert.equal(p.abstract, '');
});

test('normaliseWork: tolerates null fields, strips script tags, rejects titleless records', () => {
  const p = normaliseWork(fixture.results[2]);
  assert.equal(p.title, 'A alert(1)Survey of Large Language Models for Code');
  assert.deepEqual(p.authors, []);
  assert.equal(p.venue, '');
  assert.equal(p.url, 'https://doi.org/10.1000/xyz.123');
  assert.equal(p.oaUrl, 'https://example.org/paper.pdf');
  assert.equal(normaliseWork(fixture.results[3]), null);
  assert.equal(normaliseWork(null), null);
});

test('searchOpenAlex: normalises a successful response and caps page count at 10,000 results', async () => {
  let requested;
  const result = await searchOpenAlex({ q: 'copilot' }, { fetchImpl: async (url) => { requested = url; return respond(fixture)(); } });
  assert.ok(requested.startsWith('https://api.openalex.org/works?'));
  assert.equal(result.total, 1234);
  assert.equal(result.papers.length, 3, 'titleless record dropped');
  assert.equal(result.pages, Math.ceil(1234 / PER_PAGE));
  const big = await searchOpenAlex({ q: 'x' }, { fetchImpl: respond({ meta: { count: 5_000_000 }, results: [] }) });
  assert.equal(big.pages, 500);
});

test('searchOpenAlex: error mapping', async () => {
  const kind = async (fetchImpl, opts = {}) => { try { await searchOpenAlex({ q: 'x' }, { fetchImpl, ...opts }); } catch (e) { assert.ok(e instanceof ApiError); return e.kind; } return 'no-error'; };
  assert.equal(await kind(async () => { throw new TypeError('Failed to fetch'); }), 'network');
  assert.equal(await kind(async () => new Response('', { status: 429, headers: { 'retry-after': '3' } })), 'rate-limit');
  assert.equal(await kind(async () => new Response('', { status: 503 })), 'server');
  assert.equal(await kind(async () => new Response('', { status: 400 })), 'http');
  assert.equal(await kind(async () => new Response('<html>', { status: 200 })), 'bad-response');
  assert.equal(await kind(respond({ unexpected: true })), 'bad-response');
  const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  assert.equal(await kind(hang, { timeoutMs: 20 }), 'timeout');
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  assert.equal(await kind(hang, { signal: controller.signal, timeoutMs: 5000 }), 'aborted');
});

test('ApiError.userMessage is specific per kind', () => {
  assert.match(new ApiError('network', '').userMessage, /internet connection/);
  assert.match(new ApiError('rate-limit', '').userMessage, /too many requests/);
});

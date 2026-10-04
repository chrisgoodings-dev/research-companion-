import { CONTACT_EMAIL } from '../config.js';
import { ApiError } from './errors.js';
import { stripTags, decodeEntities, cleanAbstract, normaliseDoi, safeUrl } from './paper.js';
import { PER_PAGE, MAX_RESULTS } from './openalex.js';

const BASE = 'https://api.crossref.org/works';

const SORTS = {
  relevance: 'score',
  newest: 'published',
  cited: 'is-referenced-by-count',
};
const SELECT = ['DOI', 'title', 'author', 'issued', 'container-title', 'abstract', 'URL', 'is-referenced-by-count', 'type'].join(',');
const toYear = (v) => { const n = Number.parseInt(v, 10); return Number.isInteger(n) ? n : null; };

/** Build the request. Crossref has no open-access flag, so "open access only" is not supported here
 *  (the search orchestrator skips Crossref in that case and says so). */
export function buildSearchUrl({ q, from, to, sort = 'relevance', page = 1 }, { mailto = CONTACT_EMAIL } = {}) {
  const filters = ['type:journal-article', 'type:proceedings-article']; // same-name filters are ORed by Crossref
  const f = toYear(from);
  const t = toYear(to);
  if (f !== null) filters.push(`from-pub-date:${f}`);
  if (t !== null) filters.push(`until-pub-date:${t}`);

  const pageNumber = Math.max(1, toYear(page) ?? 1);
  const params = new URLSearchParams({
    query: String(q ?? '').trim(),
    rows: String(PER_PAGE),
    offset: String((pageNumber - 1) * PER_PAGE),
    select: SELECT,
    sort: SORTS[sort] ?? SORTS.relevance,
    order: 'desc',
    filter: filters.join(','),
  });
  if (mailto) params.set('mailto', mailto);
  return `${BASE}?${params}`;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);

/** Turn one Crossref item into the app's Paper shape (same shape as the OpenAlex one). */
export function normaliseItem(item) {
  const title = decodeEntities(stripTags(first(item?.title)));
  const doi = normaliseDoi(item?.DOI);
  if (!title || !doi) return null;

  const year = item.issued?.['date-parts']?.[0]?.[0];
  return {
    id: `doi:${doi}`,
    doi,
    title,
    authors: (item.author ?? [])
      .map((a) => decodeEntities(a?.name ?? [a?.given, a?.family].filter(Boolean).join(' ')).trim())
      .filter(Boolean),
    year: Number.isInteger(year) ? year : null,
    venue: decodeEntities(stripTags(first(item['container-title']))),
    abstract: cleanAbstract(item.abstract),
    url: safeUrl(item.URL) || `https://doi.org/${doi}`,
    oaUrl: '',
    isOa: false,          // Crossref does not say; unknown is treated as "not shown as open access"
    oaStatus: 'unknown',
    citedBy: Number.isInteger(item['is-referenced-by-count']) ? item['is-referenced-by-count'] : 0,
    type: item.type ?? '',
    source: 'crossref',
    sources: ['crossref'],
    sourceId: item.DOI,
  };
}

export async function searchCrossref(query, { fetchImpl = globalThis.fetch, signal, timeoutMs = 15000 } = {}) {
  const url = buildSearchUrl(query);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let response;
    try {
      response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    } catch (err) {
      if (timedOut) throw new ApiError('timeout', 'Request timed out');
      if (signal?.aborted || err?.name === 'AbortError') throw new ApiError('aborted', 'Search cancelled');
      throw new ApiError('network', err?.message ?? 'Network error');
    }
    if (response.status === 429) throw new ApiError('rate-limit', 'Rate limited');
    if (response.status >= 500) throw new ApiError('server', `Server error ${response.status}`);
    if (!response.ok) throw new ApiError('http', `HTTP ${response.status}`);

    let data;
    try { data = await response.json(); } catch { throw new ApiError('bad-response', 'Invalid JSON'); }
    const message = data?.message;
    if (!message || !Array.isArray(message.items) || typeof message['total-results'] !== 'number') throw new ApiError('bad-response', 'Unexpected response shape');

    const total = message['total-results'];
    return {
      total,
      page: Math.max(1, toYear(query.page) ?? 1),
      pages: Math.max(1, Math.min(Math.ceil(total / PER_PAGE), Math.floor(MAX_RESULTS / PER_PAGE))),
      papers: message.items.map(normaliseItem).filter(Boolean),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

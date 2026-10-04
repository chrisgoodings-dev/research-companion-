import { OPENALEX_MAILTO } from '../config.js';
import { ApiError } from './errors.js';
import { stripTags, normaliseDoi, safeUrl } from './paper.js';

const BASE = 'https://api.openalex.org/works';
export const PER_PAGE = 20;
export const MAX_RESULTS = 10000; // OpenAlex basic paging stops at 10,000 results

export const SORTS = {
  relevance: 'relevance_score:desc',
  newest: 'publication_date:desc',
  cited: 'cited_by_count:desc',
};

/** Ask only for the fields we use: smaller, faster responses. */
const SELECT = ['id', 'doi', 'title', 'display_name', 'publication_year', 'type', 'cited_by_count', 'authorships', 'primary_location', 'open_access', 'abstract_inverted_index'].join(',');

const toYear = (v) => { const n = Number.parseInt(v, 10); return Number.isInteger(n) ? n : null; };

/** Build the request URL. Pure, so the exact query sent to the API is unit-tested. */
export function buildSearchUrl({ q, from, to, oa = false, sort = 'relevance', page = 1 }, { mailto = OPENALEX_MAILTO } = {}) {
  const filters = [];
  const f = toYear(from);
  const t = toYear(to);
  if (f !== null && t !== null) filters.push(`publication_year:${f}-${t}`);
  else if (f !== null) filters.push(`publication_year:>${f - 1}`);
  else if (t !== null) filters.push(`publication_year:<${t + 1}`);
  if (oa) filters.push('is_oa:true');

  const params = new URLSearchParams({
    search: String(q ?? '').trim(),
    'per-page': String(PER_PAGE),
    page: String(Math.max(1, toYear(page) ?? 1)),
    select: SELECT,
    sort: SORTS[sort] ?? SORTS.relevance,
  });
  if (filters.length) params.set('filter', filters.join(','));
  if (mailto) params.set('mailto', mailto);
  return `${BASE}?${params}`;
}

/** OpenAlex ships abstracts as an "inverted index" ({ word: [positions] }) for licensing reasons.
 *  Put every word back at its position to recover the readable text. */
export function reconstructAbstract(inverted) {
  if (!inverted || typeof inverted !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(inverted)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (Number.isInteger(pos) && pos >= 0 && pos < 20000) words[pos] = word; // bound guards against bad data
    }
  }
  return words.filter((w) => w !== undefined).join(' ');
}

/** Turn one OpenAlex "work" into the app's Paper shape. Returns null for unusable records. */
export function normaliseWork(work) {
  const title = stripTags(work?.title ?? work?.display_name);
  if (!title) return null;

  const doi = normaliseDoi(work.doi);
  const sourceId = String(work.id ?? '').split('/').pop();
  const location = work.primary_location ?? {};
  const oa = work.open_access ?? {};

  return {
    id: doi ? `doi:${doi}` : `openalex:${sourceId}`,
    doi,
    title,
    authors: (work.authorships ?? []).map((a) => a?.author?.display_name).filter(Boolean),
    year: Number.isInteger(work.publication_year) ? work.publication_year : null,
    venue: stripTags(location.source?.display_name),
    abstract: reconstructAbstract(work.abstract_inverted_index),
    url: safeUrl(location.landing_page_url) || (doi ? `https://doi.org/${doi}` : ''),
    oaUrl: safeUrl(oa.oa_url) || safeUrl(location.pdf_url),
    isOa: Boolean(oa.is_oa),
    oaStatus: oa.oa_status ?? (oa.is_oa ? 'open' : 'closed'),
    citedBy: Number.isInteger(work.cited_by_count) ? work.cited_by_count : 0,
    type: work.type ?? '',
    source: 'openalex',
    sourceId,
  };
}

/** Run a search. `fetchImpl` is injectable so tests never touch the network. */
export async function searchOpenAlex(query, { fetchImpl = globalThis.fetch, signal, timeoutMs = 15000 } = {}) {
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

    if (response.status === 429) throw new ApiError('rate-limit', 'Rate limited', { retryAfter: response.headers?.get?.('retry-after') ?? null });
    if (response.status >= 500) throw new ApiError('server', `Server error ${response.status}`);
    if (!response.ok) throw new ApiError('http', `HTTP ${response.status}`);

    let data;
    try { data = await response.json(); } catch { throw new ApiError('bad-response', 'Invalid JSON'); }
    if (!data || !Array.isArray(data.results) || typeof data.meta?.count !== 'number') throw new ApiError('bad-response', 'Unexpected response shape');

    const total = data.meta.count;
    const page = data.meta.page ?? Math.max(1, toYear(query.page) ?? 1);
    return {
      total,
      page,
      pages: Math.max(1, Math.min(Math.ceil(total / PER_PAGE), Math.floor(MAX_RESULTS / PER_PAGE))),
      papers: data.results.map(normaliseWork).filter(Boolean),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

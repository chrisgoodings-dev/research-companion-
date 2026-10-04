// OpenAlex API: https://docs.openalex.org/
// Two calls are used: a keyword search (list) and a lookup by ID (detail).
const BASE = 'https://api.openalex.org/works';
// OpenAlex asks API users to identify themselves with an email (the "polite pool").
const MAILTO = 'bubbyroller@gmail.com';

const SORTS = {
  relevance: 'relevance_score:desc',
  newest: 'publication_date:desc',
  cited: 'cited_by_count:desc',
};

// Ask only for the fields the list needs: smaller, faster responses.
const LIST_FIELDS = 'id,title,display_name,publication_year,authorships,primary_location,open_access,cited_by_count';

async function getJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(err.name === 'TimeoutError'
      ? 'The request timed out. Please try again.'
      : 'Could not reach OpenAlex. Check your connection and try again.');
  }
  if (response.status === 429) throw new Error('OpenAlex is busy (rate limit). Wait a moment and try again.');
  if (response.status === 404) throw new Error('That paper was not found.');
  if (!response.ok) throw new Error(`OpenAlex returned an error (${response.status}). Please try again.`);
  return response.json();
}

/** OpenAlex titles sometimes contain HTML such as <i>. Show the words, not the tags. */
const stripTags = (text) => String(text ?? '').replace(/<[^>]*>/g, '');

/** Only follow web links the API gives us if they are https. */
function safeUrl(value) {
  return typeof value === 'string' && value.startsWith('https://') ? value : '';
}

/** OpenAlex sends abstracts as an "inverted index": { word: [positions] }.
 *  Put each word back at its position to get the readable text. */
export function rebuildAbstract(inverted) {
  if (!inverted || typeof inverted !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const position of positions) words[position] = word;
  }
  return words.join(' ');
}

/** Turn one OpenAlex "work" into the small object the pages use. */
export function toPaper(work) {
  const location = work.primary_location ?? {};
  return {
    id: String(work.id ?? '').split('/').pop(), // "https://openalex.org/W123" -> "W123"
    title: stripTags(work.title ?? work.display_name) || 'Untitled',
    authors: (work.authorships ?? []).map((a) => stripTags(a.author?.display_name)).filter(Boolean),
    year: work.publication_year ?? null,
    venue: stripTags(location.source?.display_name),
    url: safeUrl(location.landing_page_url) || safeUrl(work.doi),
    openAccessUrl: safeUrl(work.open_access?.oa_url),
    isOpenAccess: Boolean(work.open_access?.is_oa),
    citedBy: work.cited_by_count ?? 0,
    abstract: rebuildAbstract(work.abstract_inverted_index),
  };
}

/** Call 1: search by keyword, with optional year, open-access and sort options. */
export async function searchPapers({ q, from, sort = 'relevance', openAccess = false, page = 1 }) {
  const filters = [];
  if (from) filters.push(`publication_year:>${Number(from) - 1}`);
  if (openAccess) filters.push('is_oa:true');

  const params = new URLSearchParams({
    search: q,
    'per-page': '20',
    page: String(page),
    select: LIST_FIELDS,
    sort: SORTS[sort] ?? SORTS.relevance,
    mailto: MAILTO,
  });
  if (filters.length) params.set('filter', filters.join(','));

  const data = await getJson(`${BASE}?${params}`);
  return { total: data.meta.count, papers: data.results.map(toPaper) };
}

/** Call 2: get one paper, with its abstract, by OpenAlex ID (for example "W2741809807"). */
export async function getPaper(id) {
  if (!/^W\d+$/.test(id)) throw new Error('That is not a valid paper ID.');
  return toPaper(await getJson(`${BASE}/${id}?mailto=${encodeURIComponent(MAILTO)}`));
}

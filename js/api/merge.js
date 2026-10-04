/** Combine results from several sources into one de-duplicated list. Pure and unit-tested. */

/** Lower-case letters and digits only, so "A Study: X" and "a study x" match. */
export const titleKey = (title) => String(title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Same DOI => same paper. Without a DOI, fall back to title + year. */
export function dedupeKey(p) {
  return p.doi ? `doi:${p.doi}` : `title:${titleKey(p.title)}:${p.year ?? ''}`;
}

/** Merge two records of the same paper. `a` is the preferred source; `b` only fills gaps. */
export function mergePair(a, b) {
  const doi = a.doi || b.doi;
  return {
    ...a,
    id: doi ? `doi:${doi}` : a.id,
    doi,
    authors: a.authors.length ? a.authors : b.authors,
    year: a.year ?? b.year,
    venue: a.venue || b.venue,
    abstract: a.abstract.length >= b.abstract.length ? a.abstract : b.abstract,
    url: a.url || b.url,
    oaUrl: a.oaUrl || b.oaUrl,
    isOa: a.isOa || b.isOa,
    oaStatus: a.isOa ? a.oaStatus : (b.isOa ? b.oaStatus : a.oaStatus),
    citedBy: a.citedBy || b.citedBy,
    type: a.type || b.type,
    sources: [...new Set([...(a.sources ?? [a.source]), ...(b.sources ?? [b.source])])],
  };
}

const byYearThenCited = (x, y) => (y.year ?? -Infinity) - (x.year ?? -Infinity) || y.citedBy - x.citedBy;
const byCited = (x, y) => y.citedBy - x.citedBy || (y.year ?? -Infinity) - (x.year ?? -Infinity);

/** `lists` are in priority order (first = preferred source for field values).
 *  Relevance: interleave by rank so each source's best hits appear early.
 *  Newest / most cited: sort the merged page by that key. */
export function mergeResults(lists, sort = 'relevance') {
  const merged = new Map();
  const add = (paper) => {
    const key = dedupeKey(paper);
    const existing = merged.get(key);
    merged.set(key, existing ? mergePair(existing, paper) : paper);
  };
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) for (const list of lists) if (i < list.length) add(list[i]);

  const papers = [...merged.values()];
  if (sort === 'newest') papers.sort(byYearThenCited);
  else if (sort === 'cited') papers.sort(byCited);
  return papers;
}

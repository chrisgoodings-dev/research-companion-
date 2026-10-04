import { searchOpenAlex } from './openalex.js';
import { searchCrossref } from './crossref.js';
import { mergeResults } from './merge.js';
import { ApiError } from './errors.js';

export const SOURCES = { openalex: { label: 'OpenAlex', run: searchOpenAlex }, crossref: { label: 'Crossref', run: searchCrossref } };
export const ALL_SOURCES = Object.keys(SOURCES);

/** Search every chosen source in parallel and merge. A single failing source does not lose the other's
 *  results: it is reported in `notes` instead. If nothing usable came back, throw. */
export async function searchAll(query, { sources = ALL_SOURCES, fetchImpl, signal, timeoutMs } = {}) {
  const notes = [];
  let active = sources.filter((s) => Object.hasOwn(SOURCES, s));
  if (query.oa && active.includes('crossref')) {
    active = active.filter((s) => s !== 'crossref');
    notes.push({ source: 'crossref', kind: 'skipped', message: 'Crossref was skipped because it does not report open-access status.' });
  }
  if (!active.length) throw new ApiError('http', 'No source selected');

  const settled = await Promise.allSettled(active.map((s) => SOURCES[s].run(query, { fetchImpl, signal, timeoutMs })));
  const ok = [];
  const failures = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push({ source: active[i], ...r.value });
    else failures.push({ source: active[i], error: r.reason });
  });

  if (signal?.aborted || failures.some((f) => f.error?.kind === 'aborted')) throw new ApiError('aborted', 'Search cancelled');
  for (const f of failures) {
    notes.push({ source: f.source, kind: f.error?.kind ?? 'unknown', message: `${SOURCES[f.source].label} could not be searched: ${f.error?.userMessage ?? f.error?.message}` });
  }

  const papers = mergeResults(ok.map((r) => r.papers), query.sort);
  // Nothing at all, or "no results" that is really "a source failed": report a failure, not an empty result.
  if (!ok.length || (!papers.length && failures.length)) throw failures[0]?.error ?? new ApiError('server', 'No results');

  return {
    total: Math.max(...ok.map((r) => r.total)),
    page: ok[0].page,
    pages: Math.max(...ok.map((r) => r.pages)),
    papers,
    notes,
    sourcesUsed: ok.map((r) => r.source),
  };
}

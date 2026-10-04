/** Library filtering and sorting. Pure functions over the items returned by repo.papers.listAll(),
 *  so the behaviour is unit-tested without a browser. */
export const LIB_SORTS = { saved: 'Recently saved', year: 'Year (newest first)', title: 'Title (A to Z)', cited: 'Most cited' };
export const LIB_STATUSES = { any: 'Any status', unread: 'Unread', reading: 'Reading', read: 'Read' };

const norm = (s) => String(s ?? '').toLowerCase();

/** `project` is a project id or 'all'. A status filter applies to the chosen project's link
 *  (or to any link when the project is 'all'). */
export function filterPapers(items, { q = '', project = 'all', status = 'any', sort = 'saved' } = {}) {
  const needle = norm(q).trim();
  const words = needle ? needle.split(/\s+/) : [];

  const result = items.filter((p) => {
    const links = project === 'all' ? p.links : p.links.filter((l) => l.projectId === project);
    if (!links.length) return false;
    if (status !== 'any' && !links.some((l) => l.status === status)) return false;
    if (!words.length) return true;
    const haystack = norm([p.title, p.authors.join(' '), p.venue, p.year, p.doi].join(' '));
    return words.every((w) => haystack.includes(w));
  });

  const bySaved = (a, b) => b.links[0].addedAt.localeCompare(a.links[0].addedAt);
  const sorters = {
    saved: bySaved,
    year: (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || bySaved(a, b),
    title: (a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
    cited: (a, b) => b.citedBy - a.citedBy || bySaved(a, b),
  };
  return result.sort(sorters[sort] ?? sorters.saved);
}

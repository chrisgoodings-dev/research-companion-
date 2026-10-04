/** Evidence filtering. Pure, so it is unit-tested without a browser. */
import { RELATIONSHIPS } from './validation.js';

const norm = (s) => String(s ?? '').toLowerCase();

/** `records` are evidence rows; `paperTitles` maps paperId -> title (so the keyword also matches the paper).
 *  Filters: project/question ids or 'all'; relationship or 'any'; tag or 'any'; free-text q (every word must match). */
export function filterEvidence(records, paperTitles, { q = '', project = 'all', question = 'all', relationship = 'any', tag = 'any' } = {}) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return records.filter((e) => {
    if (project !== 'all' && e.projectId !== project) return false;
    if (question !== 'all' && e.researchQuestionId !== question) return false;
    if (relationship !== 'any' && e.relationship !== relationship) return false;
    if (tag !== 'any' && !e.tags.includes(tag)) return false;
    if (!words.length) return true;
    const haystack = norm([e.evidence, e.interpretation, e.location, e.tags.join(' '), paperTitles[e.paperId]].join(' '));
    return words.every((w) => haystack.includes(w));
  });
}

/** { supports: 2, contradicts: 0, ... } for a set of records. */
export function countByRelationship(records) {
  const counts = Object.fromEntries(RELATIONSHIPS.map((r) => [r, 0]));
  for (const e of records) if (e.relationship in counts) counts[e.relationship] += 1;
  return counts;
}

/** Sorted, de-duplicated list of every tag used. */
export function allTags(records) {
  return [...new Set(records.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b));
}

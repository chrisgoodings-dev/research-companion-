/** Review progress for one project. Pure and unit-tested. */
import { RELATIONSHIPS } from './validation.js';

const emptyCounts = () => Object.fromEntries(RELATIONSHIPS.map((r) => [r, 0]));

/** `papers`: repo.papers.listByProject() rows (with status, hasReview); `questions` in order; `evidence` records. */
export function buildProgress({ papers, questions, evidence }) {
  const total = papers.length;
  const byStatus = { unread: 0, reading: 0, read: 0 };
  for (const p of papers) byStatus[p.status in byStatus ? p.status : 'unread'] += 1;

  const paperIds = new Set(papers.map((p) => p.id));
  const mine = evidence.filter((e) => paperIds.has(e.paperId));
  const papersWithAnyEvidence = new Set(mine.map((e) => e.paperId));

  const questionRows = questions.map((q, i) => {
    const records = mine.filter((e) => e.researchQuestionId === q.id);
    const counts = emptyCounts();
    for (const r of records) if (r.relationship in counts) counts[r.relationship] += 1;
    const papersWithEvidence = new Set(records.map((r) => r.paperId)).size;
    return { id: q.id, label: `RQ${i + 1}`, text: q.text, evidenceCount: records.length, papersWithEvidence, counts, conflict: counts.supports > 0 && counts.contradicts > 0 };
  });

  const unreadPapers = papers.filter((p) => p.status === 'unread');
  const readWithoutEvidence = papers.filter((p) => p.status === 'read' && !papersWithAnyEvidence.has(p.id));

  const suggestions = [];
  if (!total) suggestions.push('Save some papers from Discover to get started.');
  if (!questions.length) suggestions.push('Add at least one research question to this project, so evidence has something to answer.');
  if (unreadPapers.length) suggestions.push(`${unreadPapers.length === 1 ? '1 saved paper has' : `${unreadPapers.length} saved papers have`} not been read yet.`);
  if (readWithoutEvidence.length) suggestions.push(`${readWithoutEvidence.length === 1 ? '1 paper marked as read has' : `${readWithoutEvidence.length} papers marked as read have`} no evidence recorded: ${readWithoutEvidence.map((p) => p.title).join('; ')}.`);
  for (const q of questionRows) {
    if (total && q.evidenceCount === 0) suggestions.push(`${q.label} has no evidence yet.`);
    else if (q.papersWithEvidence === 1 && total > 1) suggestions.push(`${q.label} rests on evidence from a single paper.`);
    if (q.conflict) suggestions.push(`${q.label}: the evidence conflicts (${q.counts.supports} supporting, ${q.counts.contradicts} contradicting). Compare the studies’ methods and limitations.`);
  }
  if (total && questions.length && !suggestions.length) suggestions.push('Every paper has been read and every question has evidence. Review the matrix for conflicts, then start synthesising.');

  return {
    papers: { total, ...byStatus, reviewed: papers.filter((p) => p.hasReview).length, percentRead: total ? Math.round((byStatus.read / total) * 100) : 0 },
    evidenceCount: mine.length,
    questions: questionRows,
    unreadPapers,
    readWithoutEvidence,
    suggestions,
  };
}

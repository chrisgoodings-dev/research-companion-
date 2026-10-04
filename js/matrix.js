/** Evidence matrix: papers (rows) against research questions (columns). Pure and unit-tested. */
import { RELATIONSHIPS } from './validation.js';

const emptyCounts = () => Object.fromEntries(RELATIONSHIPS.map((r) => [r, 0]));

/** `papers`: saved papers in the project; `questions`: its research questions in order;
 *  `evidence`: its evidence records. Records for papers/questions that no longer exist are ignored. */
export function buildMatrix({ papers, questions, evidence }) {
  const columns = questions.map((q, i) => ({ question: q, label: `RQ${i + 1}` }));

  const rows = papers.map((paper) => {
    const mine = evidence.filter((e) => e.paperId === paper.id);
    const cells = questions.map((q) => {
      const records = mine.filter((e) => e.researchQuestionId === q.id);
      const counts = emptyCounts();
      for (const r of records) if (r.relationship in counts) counts[r.relationship] += 1;
      return { questionId: q.id, records, counts, total: records.length };
    });
    return { paper, cells, total: cells.reduce((n, c) => n + c.total, 0) };
  });

  const summary = columns.map((col, i) => {
    const counts = emptyCounts();
    let papersWithEvidence = 0;
    for (const row of rows) {
      const cell = row.cells[i];
      if (cell.total) papersWithEvidence += 1;
      for (const r of RELATIONSHIPS) counts[r] += cell.counts[r];
    }
    const total = RELATIONSHIPS.reduce((n, r) => n + counts[r], 0);
    return {
      questionId: col.question.id,
      counts,
      total,
      papersWithEvidence,
      // The synthesis signal a researcher most needs to see: sources disagree.
      conflict: counts.supports > 0 && counts.contradicts > 0,
    };
  });

  return {
    columns,
    rows,
    summary,
    gaps: {
      papersWithoutEvidence: rows.filter((r) => r.total === 0).map((r) => r.paper),
      questionsWithoutEvidence: columns.filter((_, i) => summary[i].total === 0).map((c) => c.question),
    },
  };
}

/** Text for one cell, used for accessible names and CSV: "Supports 2, Contradicts 1" or "No evidence recorded". */
export function describeCounts(counts, labels) {
  const parts = RELATIONSHIPS.filter((r) => counts[r] > 0).map((r) => `${labels[r]} ${counts[r]}`);
  return parts.length ? parts.join(', ') : 'No evidence recorded';
}

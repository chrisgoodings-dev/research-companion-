import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrix, describeCounts } from '../../js/matrix.js';
import { filterEvidence } from '../../js/evidence.js';
import { REL_LABEL } from '../../js/ui/format.js';

const papers = [{ id: 'a', title: 'Paper A' }, { id: 'b', title: 'Paper B' }, { id: 'c', title: 'Paper C' }];
const questions = [{ id: 'q1', text: 'First?' }, { id: 'q2', text: 'Second?' }, { id: 'q3', text: 'Third?' }];
const ev = (id, paperId, researchQuestionId, relationship) => ({ id, paperId, researchQuestionId, relationship, tags: [] });
const evidence = [
  ev('1', 'a', 'q1', 'supports'),
  ev('2', 'a', 'q1', 'supports'),
  ev('3', 'a', 'q1', 'contradicts'),
  ev('4', 'b', 'q1', 'supports'),
  ev('5', 'b', 'q2', 'contextual'),
  ev('6', 'ghost-paper', 'q1', 'supports'),   // paper not in the project: ignored
  ev('7', 'a', 'ghost-question', 'mixed'),    // question not in the project: ignored
];
const m = buildMatrix({ papers, questions, evidence });

test('columns are labelled RQ1.. in question order; rows follow the papers', () => {
  assert.deepEqual(m.columns.map((c) => c.label), ['RQ1', 'RQ2', 'RQ3']);
  assert.deepEqual(m.rows.map((r) => r.paper.id), ['a', 'b', 'c']);
  assert.ok(m.rows.every((r) => r.cells.length === 3));
});

test('cells count records per relationship', () => {
  const cell = m.rows[0].cells[0];
  assert.equal(cell.total, 3);
  assert.equal(cell.counts.supports, 2);
  assert.equal(cell.counts.contradicts, 1);
  assert.equal(m.rows[1].cells[1].counts.contextual, 1);
  assert.equal(m.rows[2].cells[0].total, 0);
});

test('records for papers or questions outside the project are ignored', () => {
  assert.equal(m.rows.reduce((n, r) => n + r.total, 0), 5);
  assert.equal(m.summary.reduce((n, s) => n + s.total, 0), 5);
});

test('summary per question: totals, papers with evidence, conflict flag', () => {
  const [s1, s2, s3] = m.summary;
  assert.equal(s1.total, 4);
  assert.equal(s1.papersWithEvidence, 2);
  assert.equal(s1.conflict, true, 'supports and contradicts both present');
  assert.equal(s2.conflict, false);
  assert.equal(s2.total, 1);
  assert.equal(s3.total, 0);
});

test('gaps: papers and questions with no evidence', () => {
  assert.deepEqual(m.gaps.papersWithoutEvidence.map((p) => p.id), ['c']);
  assert.deepEqual(m.gaps.questionsWithoutEvidence.map((q) => q.id), ['q3']);
});

test('empty inputs are fine', () => {
  const empty = buildMatrix({ papers: [], questions: [], evidence: [] });
  assert.deepEqual([empty.columns, empty.rows, empty.summary], [[], [], []]);
  assert.equal(buildMatrix({ papers, questions: [], evidence }).rows[0].total, 0);
});

test('describeCounts gives a readable sentence for accessible names and CSV', () => {
  assert.equal(describeCounts(m.rows[0].cells[0].counts, REL_LABEL), 'Supports 2, Contradicts 1');
  assert.equal(describeCounts(m.rows[2].cells[0].counts, REL_LABEL), 'No evidence recorded');
});

test('filterEvidence can narrow to one paper', () => {
  assert.deepEqual(filterEvidence(evidence, {}, { paper: 'b' }).map((e) => e.id), ['4', '5']);
  assert.deepEqual(filterEvidence(evidence, {}, { paper: 'b', question: 'q2' }).map((e) => e.id), ['5']);
});

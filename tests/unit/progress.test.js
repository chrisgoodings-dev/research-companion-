import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgress } from '../../js/progress.js';

const paper = (id, status, hasReview = false) => ({ id, title: `Paper ${id}`, status, hasReview });
const questions = [{ id: 'q1', text: 'First?' }, { id: 'q2', text: 'Second?' }, { id: 'q3', text: 'Third?' }];
const ev = (id, paperId, researchQuestionId, relationship) => ({ id, paperId, researchQuestionId, relationship });

test('reading progress counts statuses, reviews and the percentage read', () => {
  const p = buildProgress({ papers: [paper('a', 'read', true), paper('b', 'read'), paper('c', 'reading', true), paper('d', 'unread')], questions: [], evidence: [] });
  assert.deepEqual([p.papers.total, p.papers.read, p.papers.reading, p.papers.unread, p.papers.reviewed, p.papers.percentRead], [4, 2, 1, 1, 2, 50]);
  assert.equal(buildProgress({ papers: [], questions: [], evidence: [] }).papers.percentRead, 0, 'no division by zero');
  assert.equal(buildProgress({ papers: [paper('a', 'weird')], questions: [], evidence: [] }).papers.unread, 1, 'unknown status counts as unread');
});

test('per-question coverage: evidence count, distinct papers, relationship counts, conflict', () => {
  const papers = [paper('a', 'read'), paper('b', 'read'), paper('c', 'read')];
  const evidence = [ev('1', 'a', 'q1', 'supports'), ev('2', 'a', 'q1', 'supports'), ev('3', 'b', 'q1', 'contradicts'), ev('4', 'a', 'q2', 'contextual')];
  const p = buildProgress({ papers, questions, evidence });
  const [q1, q2, q3] = p.questions;
  assert.deepEqual([q1.label, q1.evidenceCount, q1.papersWithEvidence, q1.conflict], ['RQ1', 3, 2, true]);
  assert.deepEqual([q2.evidenceCount, q2.papersWithEvidence, q2.conflict], [1, 1, false]);
  assert.deepEqual([q3.evidenceCount, q3.papersWithEvidence], [0, 0]);
  assert.equal(p.evidenceCount, 4);
});

test('evidence about papers not in the project is ignored', () => {
  const p = buildProgress({ papers: [paper('a', 'read')], questions, evidence: [ev('1', 'ghost', 'q1', 'supports')] });
  assert.equal(p.evidenceCount, 0);
  assert.equal(p.questions[0].evidenceCount, 0);
});

test('to-do lists: unread papers, and papers read but without evidence', () => {
  const p = buildProgress({ papers: [paper('a', 'read'), paper('b', 'read'), paper('c', 'unread')], questions, evidence: [ev('1', 'a', 'q1', 'supports')] });
  assert.deepEqual(p.unreadPapers.map((x) => x.id), ['c']);
  assert.deepEqual(p.readWithoutEvidence.map((x) => x.id), ['b']);
});

test('suggestions describe what to do next, in priority order', () => {
  assert.deepEqual(buildProgress({ papers: [], questions: [], evidence: [] }).suggestions.length, 2);
  const s = buildProgress({ papers: [paper('a', 'read'), paper('b', 'unread')], questions: questions.slice(0, 2), evidence: [ev('1', 'a', 'q1', 'supports')] }).suggestions;
  assert.ok(s[0].includes('1 saved paper has not been read'));
  assert.ok(s.some((x) => x.includes('RQ1 rests on evidence from a single paper')));
  assert.ok(s.some((x) => x.includes('RQ2 has no evidence yet')));
  const conflict = buildProgress({ papers: [paper('a', 'read'), paper('b', 'read')], questions: questions.slice(0, 1), evidence: [ev('1', 'a', 'q1', 'supports'), ev('2', 'b', 'q1', 'contradicts')] }).suggestions;
  assert.ok(conflict.some((x) => x.includes('RQ1: the evidence conflicts (1 supporting, 1 contradicting)')));
});

test('a finished project gets a positive next step', () => {
  const s = buildProgress({ papers: [paper('a', 'read'), paper('b', 'read')], questions: questions.slice(0, 1), evidence: [ev('1', 'a', 'q1', 'supports'), ev('2', 'b', 'q1', 'supports')] }).suggestions;
  assert.equal(s.length, 1);
  assert.ok(s[0].includes('start synthesising'));
});

test('singular and plural wording', () => {
  assert.ok(buildProgress({ papers: [paper('a', 'unread')], questions, evidence: [] }).suggestions[0].startsWith('1 saved paper has'));
  assert.ok(buildProgress({ papers: [paper('a', 'unread'), paper('b', 'unread')], questions, evidence: [] }).suggestions[0].startsWith('2 saved papers have'));
});

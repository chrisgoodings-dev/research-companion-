import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { openDatabase } from '../../js/db/db.js';
import { createRepository } from '../../js/db/repository.js';
import { parseTags, tagsError, validateEvidence, RELATIONSHIPS, ValidationError } from '../../js/validation.js';
import { filterEvidence, countByRelationship, allTags } from '../../js/evidence.js';

let n = 0;
const freshRepo = async () => createRepository(await openDatabase(`ev-${n++}`, new IDBFactory()));
const paper = (id) => ({ id, title: `Paper ${id}`, authors: ['A'], year: 2021, sources: ['openalex'] });

async function world(repo) {
  const project = await repo.projects.create({ name: 'Project one' });
  const rq1 = await repo.questions.create(project.id, { text: 'Does AI improve productivity?' });
  const rq2 = await repo.questions.create(project.id, { text: 'What risks does AI code carry?' });
  await repo.papers.saveToProject(project.id, paper('p1'));
  const base = { projectId: project.id, paperId: 'p1', researchQuestionId: rq1.id, relationship: 'supports', evidence: 'Developers finished 55% faster.' };
  return { project, rq1, rq2, base };
}

/* ---------- validation ---------- */
test('parseTags lower-cases, trims, collapses spaces and de-duplicates', () => {
  assert.deepEqual(parseTags(' Productivity,  controlled   Experiment , productivity,, '), ['productivity', 'controlled experiment']);
  assert.deepEqual(parseTags(['A', 'a', ' b ']), ['a', 'b']);
  assert.deepEqual(parseTags(''), []);
  assert.deepEqual(parseTags(undefined), []);
});

test('tagsError enforces count and length', () => {
  assert.equal(tagsError('a, b, c'), '');
  assert.match(tagsError(Array.from({ length: 11 }, (_, i) => `t${i}`).join(',')), /at most 10/);
  assert.match(tagsError('x'.repeat(41)), /at most 40/);
});

test('validateEvidence: requires question, relationship and evidence; keeps interpretation optional', () => {
  const good = validateEvidence({ projectId: 'p', paperId: 'x', researchQuestionId: 'q', relationship: 'mixed', evidence: ' It depends. ', tags: 'A, b' });
  assert.equal(good.valid, true);
  assert.equal(good.values.evidence, 'It depends.');
  assert.equal(good.values.interpretation, '');
  assert.deepEqual(good.values.tags, ['a', 'b']);
  const bad = validateEvidence({ projectId: 'p', paperId: 'x' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['evidence', 'relationship', 'researchQuestionId']);
  assert.equal(validateEvidence({ projectId: 'p', paperId: 'x', researchQuestionId: 'q', relationship: 'maybe', evidence: 'e' }).errors.relationship.includes('Choose'), true);
  assert.equal(validateEvidence({ projectId: 'p', paperId: 'x', researchQuestionId: 'q', relationship: 'none', evidence: 'e'.repeat(3001) }).valid, false);
  assert.deepEqual(RELATIONSHIPS, ['supports', 'contradicts', 'mixed', 'contextual', 'none']);
});

/* ---------- repository ---------- */
test('create stores evidence and list methods return it newest first', async () => {
  const repo = await freshRepo();
  const { project, base, rq2 } = await world(repo);
  const first = await repo.evidence.create({ ...base, tags: 'speed' });
  await new Promise((r) => setTimeout(r, 5));
  const second = await repo.evidence.create({ ...base, researchQuestionId: rq2.id, relationship: 'contradicts', evidence: 'More bugs.', interpretation: 'Quality drops.' });
  assert.deepEqual((await repo.evidence.listByPaper(project.id, 'p1')).map((e) => e.id), [second.id, first.id]);
  assert.deepEqual((await repo.evidence.listByProject(project.id)).map((e) => e.id), [second.id, first.id]);
  assert.equal((await repo.evidence.listAll()).length, 2);
  assert.equal((await repo.counts()).evidenceNotes, 2);
  assert.equal(second.interpretation, 'Quality drops.');
});

test('create enforces integrity: valid input, saved paper, question in the same project', async () => {
  const repo = await freshRepo();
  const { base } = await world(repo);
  const other = await repo.projects.create({ name: 'Project two' });
  const otherQ = await repo.questions.create(other.id, { text: 'A question in another project?' });
  await assert.rejects(repo.evidence.create({ ...base, evidence: '' }), ValidationError);
  await assert.rejects(repo.evidence.create({ ...base, researchQuestionId: otherQ.id }), /not part of this project/);
  await assert.rejects(repo.evidence.create({ ...base, paperId: 'unsaved' }), /not saved in this project/);
  await assert.rejects(repo.evidence.create({ ...base, researchQuestionId: 'missing' }), /not part of this project/);
  assert.equal((await repo.counts()).evidenceNotes, 0);
});

test('update edits fields, can move to another question in the same project, cannot change paper or project', async () => {
  const repo = await freshRepo();
  const { project, base, rq2 } = await world(repo);
  const e = await repo.evidence.create(base);
  await new Promise((r) => setTimeout(r, 5));
  const u = await repo.evidence.update(e.id, { researchQuestionId: rq2.id, relationship: 'mixed', evidence: 'Revised.', interpretation: 'Mine.', location: 'p. 4', tags: 'x', paperId: 'hijack', projectId: 'hijack' });
  assert.equal(u.researchQuestionId, rq2.id);
  assert.equal(u.relationship, 'mixed');
  assert.equal(u.paperId, 'p1', 'paper cannot be changed');
  assert.equal(u.projectId, project.id, 'project cannot be changed');
  assert.equal(u.createdAt, e.createdAt);
  assert.ok(u.updatedAt > e.updatedAt);
  await assert.rejects(repo.evidence.update(e.id, { ...base, evidence: '' }), ValidationError);
  await assert.rejects(repo.evidence.update('missing', base), /not found/);
  const other = await repo.projects.create({ name: 'Project two' });
  const otherQ = await repo.questions.create(other.id, { text: 'A question in another project?' });
  await assert.rejects(repo.evidence.update(e.id, { ...base, researchQuestionId: otherQ.id }), /not part of this project/);
});

test('remove deletes one record', async () => {
  const repo = await freshRepo();
  const { project, base } = await world(repo);
  const e = await repo.evidence.create(base);
  await repo.evidence.remove(e.id);
  assert.equal((await repo.evidence.listByProject(project.id)).length, 0);
});

test('cascades: removing a question, a paper link or a project removes its evidence', async () => {
  const repo = await freshRepo();
  const { project, base, rq1, rq2 } = await world(repo);
  await repo.evidence.create(base);
  await repo.evidence.create({ ...base, researchQuestionId: rq2.id });
  await repo.questions.remove(rq1.id);
  assert.equal((await repo.counts()).evidenceNotes, 1, 'evidence for the removed question is gone');
  await repo.papers.removeFromProject(project.id, 'p1');
  assert.equal((await repo.counts()).evidenceNotes, 0, 'evidence for the removed paper link is gone');

  const { project: p2, base: b2 } = await world(repo);
  await repo.evidence.create(b2);
  await repo.projects.remove(p2.id);
  assert.equal((await repo.counts()).evidenceNotes, 0, 'project deletion removes evidence');
});

test('evidence about the same paper in another project is untouched', async () => {
  const repo = await freshRepo();
  const a = await world(repo);
  const b = await world(repo);
  await repo.evidence.create(a.base);
  await repo.evidence.create(b.base);
  await repo.papers.removeFromProject(a.project.id, 'p1');
  assert.deepEqual((await repo.evidence.listAll()).map((e) => e.projectId), [b.project.id]);
});

/* ---------- filtering ---------- */
const rec = (id, over) => ({ id, projectId: 'p1', paperId: 'a', researchQuestionId: 'q1', relationship: 'supports', evidence: 'text', interpretation: '', location: '', tags: [], createdAt: '2026-01-01', ...over });
const records = [
  rec('1', { evidence: 'Developers were 55% faster', tags: ['speed', 'experiment'] }),
  rec('2', { relationship: 'contradicts', researchQuestionId: 'q2', evidence: 'More defects', interpretation: 'Quality risk', tags: ['quality'] }),
  rec('3', { projectId: 'p2', paperId: 'b', relationship: 'mixed', evidence: 'Mixed result', location: 'Table 3' }),
];
const titles = { a: 'Neural completion', b: 'Pair programming' };
const ids = (r) => r.map((x) => x.id);

test('filterEvidence by project, question, relationship and tag', () => {
  assert.deepEqual(ids(filterEvidence(records, titles)), ['1', '2', '3']);
  assert.deepEqual(ids(filterEvidence(records, titles, { project: 'p2' })), ['3']);
  assert.deepEqual(ids(filterEvidence(records, titles, { question: 'q2' })), ['2']);
  assert.deepEqual(ids(filterEvidence(records, titles, { relationship: 'supports' })), ['1']);
  assert.deepEqual(ids(filterEvidence(records, titles, { tag: 'quality' })), ['2']);
  assert.deepEqual(ids(filterEvidence(records, titles, { project: 'p1', relationship: 'mixed' })), []);
});

test('filterEvidence keyword searches evidence, interpretation, location, tags and paper title', () => {
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'FASTER' })), ['1']);
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'quality' })), ['2']);
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'table 3' })), ['3']);
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'pair' })), ['3']);
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'speed experiment' })), ['1']);
  assert.deepEqual(ids(filterEvidence(records, titles, { q: 'speed defects' })), []);
});

test('countByRelationship and allTags', () => {
  assert.deepEqual(countByRelationship(records), { supports: 1, contradicts: 1, mixed: 1, contextual: 0, none: 0 });
  assert.deepEqual(allTags(records), ['experiment', 'quality', 'speed']);
});

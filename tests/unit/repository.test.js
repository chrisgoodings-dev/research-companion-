import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto'; // provides the IDBKeyRange global used by the repository
import { openDatabase, finished } from '../../js/db/db.js';
import { createRepository } from '../../js/db/repository.js';
import { ValidationError } from '../../js/validation.js';

let n = 0;
async function freshRepo() {
  const db = await openDatabase(`test-${n++}`, new IDBFactory());
  return createRepository(db);
}

test('creates, lists (newest first), gets and updates projects', async () => {
  const repo = await freshRepo();
  const a = await repo.projects.create({ name: 'First project', description: '' });
  await new Promise((r) => setTimeout(r, 5));
  const b = await repo.projects.create({ name: 'Second project', description: 'about' });
  assert.deepEqual((await repo.projects.list()).map((p) => p.id), [b.id, a.id]);
  const updated = await repo.projects.update(a.id, { name: 'First renamed', description: 'new' });
  assert.equal(updated.name, 'First renamed');
  assert.equal((await repo.projects.list())[0].id, a.id, 'updated project moves to the top');
  assert.equal((await repo.projects.get(a.id)).description, 'new');
});

test('rejects invalid data before it reaches the database', async () => {
  const repo = await freshRepo();
  await assert.rejects(repo.projects.create({ name: 'x' }), ValidationError);
  assert.equal((await repo.counts()).projects, 0);
});

test('questions are ordered per project and numbered by position', async () => {
  const repo = await freshRepo();
  const p1 = await repo.projects.create({ name: 'Project one' });
  const p2 = await repo.projects.create({ name: 'Project two' });
  const q1 = await repo.questions.create(p1.id, { text: 'How does X affect Y in practice?' });
  const q2 = await repo.questions.create(p1.id, { text: 'What are the limits of Z?' });
  await repo.questions.create(p2.id, { text: 'An unrelated question here?' });
  const list = await repo.questions.listByProject(p1.id);
  assert.deepEqual(list.map((q) => q.id), [q1.id, q2.id]);
  assert.deepEqual(list.map((q) => q.position), [1, 2]);
});

test('question: cannot be added to a missing project; can be edited and removed', async () => {
  const repo = await freshRepo();
  await assert.rejects(repo.questions.create('nope', { text: 'A perfectly good question?' }), /Project not found/);
  const p = await repo.projects.create({ name: 'Project one' });
  const q = await repo.questions.create(p.id, { text: 'Original wording of question' });
  await repo.questions.update(q.id, { text: 'Revised wording of question' });
  assert.equal((await repo.questions.listByProject(p.id))[0].text, 'Revised wording of question');
  await repo.questions.remove(q.id);
  assert.equal((await repo.questions.listByProject(p.id)).length, 0);
});

test('deleting a project cascades to its questions and evidence only', async () => {
  const repo = await freshRepo();
  const keep = await repo.projects.create({ name: 'Keep this one' });
  const drop = await repo.projects.create({ name: 'Delete this one' });
  await repo.questions.create(keep.id, { text: 'A question that must survive' });
  await repo.questions.create(drop.id, { text: 'A question that must go away' });
  // Evidence records arrive in Stage 7; seed raw rows now to prove the cascade already works.
  const tx = repo.db.transaction('evidenceNotes', 'readwrite');
  tx.objectStore('evidenceNotes').add({ id: 'e1', projectId: drop.id, researchQuestionId: 'x' });
  tx.objectStore('evidenceNotes').add({ id: 'e2', projectId: keep.id, researchQuestionId: 'y' });
  await finished(tx);

  await repo.projects.remove(drop.id);
  assert.equal(await repo.projects.get(drop.id), undefined);
  assert.deepEqual(await repo.counts(), { projects: 1, researchQuestions: 1, papers: 0, evidenceNotes: 1 });
});

test('removing a question removes evidence recorded against it', async () => {
  const repo = await freshRepo();
  const p = await repo.projects.create({ name: 'Project one' });
  const q = await repo.questions.create(p.id, { text: 'Question with some evidence' });
  const tx = repo.db.transaction('evidenceNotes', 'readwrite');
  tx.objectStore('evidenceNotes').add({ id: 'e1', projectId: p.id, researchQuestionId: q.id });
  tx.objectStore('evidenceNotes').add({ id: 'e2', projectId: p.id, researchQuestionId: 'other' });
  await finished(tx);
  await repo.questions.remove(q.id);
  assert.equal((await repo.counts()).evidenceNotes, 1);
});

/* ---------- saved papers ---------- */
const paper = (id, extra = {}) => ({ id, title: `Paper ${id}`, doi: '', authors: ['A'], year: 2021, sources: ['openalex'], ...extra });

test('saveToProject stores the paper once and links it per project', async () => {
  const repo = await freshRepo();
  const p1 = await repo.projects.create({ name: 'Project one' });
  const p2 = await repo.projects.create({ name: 'Project two' });
  assert.equal((await repo.papers.saveToProject(p1.id, paper('doi:10.1/a'))).created, true);
  assert.equal((await repo.papers.saveToProject(p1.id, paper('doi:10.1/a'))).created, false, 'second save to same project is a no-op');
  assert.equal((await repo.papers.saveToProject(p2.id, paper('doi:10.1/a'))).created, true, 'same paper can live in another project');
  const c = await repo.counts();
  assert.equal(c.papers, 1, 'one shared paper record');
  assert.deepEqual((await repo.papers.listByProject(p1.id)).map((p) => p.id), ['doi:10.1/a']);
  const map = await repo.papers.savedMap();
  assert.deepEqual([...map['doi:10.1/a']].sort(), [p1.id, p2.id].sort(), 'order is not significant');
});

test('saveToProject validates input and requires a real project', async () => {
  const repo = await freshRepo();
  const p = await repo.projects.create({ name: 'Project one' });
  await assert.rejects(repo.papers.saveToProject(p.id, { id: '', title: '' }), ValidationError);
  await assert.rejects(repo.papers.saveToProject('missing', paper('x')), /Project not found/);
  assert.equal((await repo.counts()).papers, 0);
});

test('saving again refreshes stored metadata', async () => {
  const repo = await freshRepo();
  const p = await repo.projects.create({ name: 'Project one' });
  await repo.papers.saveToProject(p.id, paper('doi:10.1/a', { abstract: '' }));
  await repo.papers.saveToProject(p.id, paper('doi:10.1/a', { abstract: 'Now with an abstract' }));
  assert.equal((await repo.papers.listByProject(p.id))[0].abstract, 'Now with an abstract');
});

test('listByProject is newest-first', async () => {
  const repo = await freshRepo();
  const p = await repo.projects.create({ name: 'Project one' });
  await repo.papers.saveToProject(p.id, paper('a'));
  await new Promise((r) => setTimeout(r, 5));
  await repo.papers.saveToProject(p.id, paper('b'));
  assert.deepEqual((await repo.papers.listByProject(p.id)).map((x) => x.id), ['b', 'a']);
});

test('removeFromProject removes only that project\'s link and evidence, and prunes orphans', async () => {
  const repo = await freshRepo();
  const p1 = await repo.projects.create({ name: 'Project one' });
  const p2 = await repo.projects.create({ name: 'Project two' });
  await repo.papers.saveToProject(p1.id, paper('shared'));
  await repo.papers.saveToProject(p2.id, paper('shared'));
  await repo.papers.saveToProject(p1.id, paper('solo'));
  const tx = repo.db.transaction('evidenceNotes', 'readwrite');
  tx.objectStore('evidenceNotes').add({ id: 'e1', projectId: p1.id, paperId: 'shared', researchQuestionId: 'q' });
  tx.objectStore('evidenceNotes').add({ id: 'e2', projectId: p2.id, paperId: 'shared', researchQuestionId: 'q' });
  await finished(tx);

  await repo.papers.removeFromProject(p1.id, 'shared');
  assert.equal((await repo.counts()).evidenceNotes, 1, "other project's evidence about the same paper survives");
  assert.equal((await repo.counts()).papers, 2, 'shared paper still referenced by project two');
  await repo.papers.removeFromProject(p1.id, 'solo');
  assert.equal((await repo.counts()).papers, 1, 'unreferenced paper pruned');
});

test('deleting a project removes its links and prunes papers only it used', async () => {
  const repo = await freshRepo();
  const keep = await repo.projects.create({ name: 'Keep this one' });
  const drop = await repo.projects.create({ name: 'Delete this one' });
  await repo.papers.saveToProject(keep.id, paper('shared'));
  await repo.papers.saveToProject(drop.id, paper('shared'));
  await repo.papers.saveToProject(drop.id, paper('only-drop'));
  await repo.projects.remove(drop.id);
  assert.equal((await repo.counts()).papers, 1);
  assert.deepEqual((await repo.papers.listByProject(keep.id)).map((p) => p.id), ['shared']);
  assert.deepEqual(await repo.papers.savedMap(), { shared: [keep.id] });
});

import { wrap, finished } from './db.js';
import { assertValid, validateProject, validateQuestion, validatePaper, validateReview, validateEvidence } from '../validation.js';

const newId = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

/** All data access goes through here, so views never touch IndexedDB directly. */
export function createRepository(db) {
  const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

  /** Delete every record in `storeName` whose `indexName` equals `key`, inside an open transaction. */
  function deleteByIndex(tx, storeName, indexName, key) {
    return new Promise((resolve, reject) => {
      const cursorRequest = tx.objectStore(storeName).index(indexName).openKeyCursor(IDBKeyRange.only(key));
      cursorRequest.onerror = () => reject(cursorRequest.error);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) { resolve(); return; }
        tx.objectStore(storeName).delete(cursor.primaryKey);
        cursor.continue();
      };
    });
  }

  /** Like deleteByIndex, but only deletes records that also satisfy `predicate` (a second key). */
  function deleteWhere(tx, storeName, indexName, key, predicate) {
    return new Promise((resolve, reject) => {
      const request = tx.objectStore(storeName).index(indexName).openCursor(IDBKeyRange.only(key));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(); return; }
        if (predicate(cursor.value)) cursor.delete();
        cursor.continue();
      };
    });
  }

  const projects = {
    async list() {
      const all = await wrap(store('projects').getAll());
      return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    get: (id) => wrap(store('projects').get(id)),
    async create(input) {
      const values = assertValid(validateProject(input));
      const record = { id: newId(), ...values, createdAt: now(), updatedAt: now() };
      await wrap(store('projects', 'readwrite').add(record));
      return record;
    },
    async update(id, input) {
      const values = assertValid(validateProject(input));
      const existing = await projects.get(id);
      if (!existing) throw new Error('Project not found.');
      const record = { ...existing, ...values, updatedAt: now() };
      await wrap(store('projects', 'readwrite').put(record));
      return record;
    },
    /** Deleting a project removes everything that belongs to it, atomically. */
    async remove(id) {
      const tx = db.transaction(['projects', 'researchQuestions', 'projectPapers', 'evidenceNotes'], 'readwrite');
      const done = finished(tx);
      tx.objectStore('projects').delete(id);
      await Promise.all([
        deleteByIndex(tx, 'researchQuestions', 'projectId', id),
        deleteByIndex(tx, 'projectPapers', 'projectId', id),
        deleteByIndex(tx, 'evidenceNotes', 'projectId', id),
      ]);
      await done;
      await papers.pruneOrphans(); // papers only this project referenced are no longer needed
    },
  };

  const questions = {
    async listByProject(projectId) {
      const all = await wrap(store('researchQuestions').index('projectId').getAll(projectId));
      return all.sort((a, b) => a.position - b.position);
    },
    async create(projectId, input) {
      const { text } = assertValid(validateQuestion(input));
      if (!(await projects.get(projectId))) throw new Error('Project not found.');
      const existing = await questions.listByProject(projectId);
      const position = existing.reduce((max, q) => Math.max(max, q.position), 0) + 1;
      const record = { id: newId(), projectId, text, position, createdAt: now(), updatedAt: now() };
      await wrap(store('researchQuestions', 'readwrite').add(record));
      return record;
    },
    async update(id, input) {
      const { text } = assertValid(validateQuestion(input));
      const existing = await wrap(store('researchQuestions').get(id));
      if (!existing) throw new Error('Research question not found.');
      const record = { ...existing, text, updatedAt: now() };
      await wrap(store('researchQuestions', 'readwrite').put(record));
      return record;
    },
    /** Removing a question also removes evidence recorded against it. */
    async remove(id) {
      const tx = db.transaction(['researchQuestions', 'evidenceNotes'], 'readwrite');
      const done = finished(tx);
      tx.objectStore('researchQuestions').delete(id);
      await deleteByIndex(tx, 'evidenceNotes', 'researchQuestionId', id);
      await done;
    },
  };

  /** Saved papers. A paper record is shared; a projectPapers link says "this project has this paper".
   *  The link id is `${projectId}:${paperId}`, so saving the same paper to the same project twice is a no-op. */
  const papers = {
    async saveToProject(projectId, input) {
      const paper = assertValid(validatePaper(input));
      if (!(await projects.get(projectId))) throw new Error('Project not found.');
      const tx = db.transaction(['papers', 'projectPapers'], 'readwrite');
      const done = finished(tx);
      const linkId = `${projectId}:${paper.id}`;
      const existing = await wrap(tx.objectStore('projectPapers').get(linkId));
      tx.objectStore('papers').put(paper); // refresh stored metadata with the latest merged record
      if (!existing) tx.objectStore('projectPapers').add({ id: linkId, projectId, paperId: paper.id, addedAt: now(), status: 'unread', review: null, reviewedAt: null });
      await done;
      return { created: !existing, paper };
    },

    /** Papers in a project, newest first, each with `addedAt`, `status` and `hasReview`. */
    async listByProject(projectId) {
      const links = await wrap(store('projectPapers').index('projectId').getAll(projectId));
      const rows = await Promise.all(links.map(async (l) => {
        const paper = await wrap(store('papers').get(l.paperId));
        return paper ? { ...paper, addedAt: l.addedAt, status: l.status ?? 'unread', hasReview: Boolean(l.review) } : null;
      }));
      return rows.filter(Boolean).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    },

    /** Every saved paper with its project links (status, review), newest save first. Used by the Library. */
    async listAll() {
      const [all, links] = await Promise.all([wrap(store('papers').getAll()), wrap(store('projectPapers').getAll())]);
      const byPaper = new Map();
      for (const l of links) {
        const entry = { projectId: l.projectId, addedAt: l.addedAt, status: l.status ?? 'unread', hasReview: Boolean(l.review), reviewedAt: l.reviewedAt ?? null };
        byPaper.set(l.paperId, [...(byPaper.get(l.paperId) ?? []), entry]);
      }
      return all
        .map((paper) => ({ ...paper, links: (byPaper.get(paper.id) ?? []).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) }))
        .filter((p) => p.links.length)
        .sort((a, b) => b.links[0].addedAt.localeCompare(a.links[0].addedAt));
    },

    /** One paper plus every project link (with full review text), or undefined if it is not saved. */
    async getWithLinks(paperId) {
      const paper = await wrap(store('papers').get(paperId));
      if (!paper) return undefined;
      const links = await wrap(store('projectPapers').index('paperId').getAll(paperId));
      return { ...paper, links: links.map((l) => ({ ...l, status: l.status ?? 'unread', review: l.review ?? null })).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) };
    },

    /** Save the structured review for a paper within one project (the link must already exist). */
    async saveReview(projectId, paperId, input) {
      const values = assertValid(validateReview(input));
      const { status, ...fields } = values;
      const tx = db.transaction('projectPapers', 'readwrite');
      const done = finished(tx);
      const link = await wrap(tx.objectStore('projectPapers').get(`${projectId}:${paperId}`));
      if (!link) { tx.abort(); await done.catch(() => {}); throw new Error('That paper is not saved in this project.'); }
      const updated = { ...link, status, review: fields, reviewedAt: now() };
      tx.objectStore('projectPapers').put(updated);
      await done;
      return updated;
    },

    /** { [paperId]: [projectId, ...] } for every saved paper, so search results can show what is saved. */
    async savedMap() {
      const links = await wrap(store('projectPapers').getAll());
      const map = {};
      for (const l of links) (map[l.paperId] ??= []).push(l.projectId);
      return map;
    },

    /** Remove a paper from one project, along with that project's evidence about it. */
    async removeFromProject(projectId, paperId) {
      const tx = db.transaction(['projectPapers', 'evidenceNotes'], 'readwrite');
      const done = finished(tx);
      tx.objectStore('projectPapers').delete(`${projectId}:${paperId}`);
      await deleteWhere(tx, 'evidenceNotes', 'paperId', paperId, (note) => note.projectId === projectId);
      await done;
      await papers.pruneOrphans();
    },

    /** Delete paper records that no project links to any more. */
    async pruneOrphans() {
      const tx = db.transaction(['papers', 'projectPapers'], 'readwrite');
      const done = finished(tx);
      const [keys, links] = await Promise.all([wrap(tx.objectStore('papers').getAllKeys()), wrap(tx.objectStore('projectPapers').getAll())]);
      const used = new Set(links.map((l) => l.paperId));
      for (const key of keys) if (!used.has(key)) tx.objectStore('papers').delete(key);
      await done;
    },
  };

  /** Evidence records. Integrity rules: the paper must be saved in the project, and the research question
   *  must belong to that same project. Evidence is removed automatically with its question, its paper link
   *  or its project (see those remove() methods). */
  const evidence = {
    async create(input) {
      const values = assertValid(validateEvidence(input));
      await evidence.assertConsistent(values);
      const record = { id: newId(), ...values, createdAt: now(), updatedAt: now() };
      await wrap(store('evidenceNotes', 'readwrite').add(record));
      return record;
    },

    /** Edit text, relationship, tags or move the record to another question in the same project. */
    async update(id, input) {
      const existing = await wrap(store('evidenceNotes').get(id));
      if (!existing) throw new Error('Evidence record not found.');
      const values = assertValid(validateEvidence({ ...input, projectId: existing.projectId, paperId: existing.paperId }));
      await evidence.assertConsistent(values, { skipLink: true });
      const record = { ...existing, ...values, updatedAt: now() };
      await wrap(store('evidenceNotes', 'readwrite').put(record));
      return record;
    },

    remove: (id) => wrap(store('evidenceNotes', 'readwrite').delete(id)),

    async assertConsistent({ projectId, paperId, researchQuestionId }, { skipLink = false } = {}) {
      const question = await wrap(store('researchQuestions').get(researchQuestionId));
      if (!question || question.projectId !== projectId) throw new Error('That research question is not part of this project.');
      if (!skipLink && !(await wrap(store('projectPapers').get(`${projectId}:${paperId}`)))) throw new Error('That paper is not saved in this project.');
    },

    /** Newest first. */
    async listByPaper(projectId, paperId) {
      const all = await wrap(store('evidenceNotes').index('paperId').getAll(paperId));
      return all.filter((e) => e.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listByProject(projectId) {
      const all = await wrap(store('evidenceNotes').index('projectId').getAll(projectId));
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async listAll() {
      return (await wrap(store('evidenceNotes').getAll())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };

  async function counts() {
    const names = ['projects', 'researchQuestions', 'papers', 'evidenceNotes'];
    const values = await Promise.all(names.map((n) => wrap(store(n).count())));
    return Object.fromEntries(names.map((n, i) => [n, values[i]]));
  }

  return { projects, questions, papers, evidence, counts, db };
}

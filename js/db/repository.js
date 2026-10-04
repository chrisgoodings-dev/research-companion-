import { wrap, finished } from './db.js';
import { assertValid, validateProject, validateQuestion } from '../validation.js';

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

  async function counts() {
    const names = ['projects', 'researchQuestions', 'papers', 'evidenceNotes'];
    const values = await Promise.all(names.map((n) => wrap(store(n).count())));
    return Object.fromEntries(names.map((n, i) => [n, values[i]]));
  }

  return { projects, questions, counts, db };
}

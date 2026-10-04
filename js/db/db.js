/** Thin promise wrapper around IndexedDB. Research data lives here (structured, queryable);
 *  localStorage is kept for tiny preferences such as the theme. */
export const DB_NAME = 'se-research-hub';
export const DB_VERSION = 1;

/** Object stores and their indexes (created once, in the v1 upgrade). */
export const SCHEMA = {
  projects: { indexes: [] },
  researchQuestions: { indexes: ['projectId'] },
  papers: { indexes: ['doi'] },
  projectPapers: { indexes: ['projectId', 'paperId'] },
  evidenceNotes: { indexes: ['projectId', 'paperId', 'researchQuestionId'] },
};

export function openDatabase(name = DB_NAME, factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(new Error('IndexedDB is not available in this browser.')); return; }
    const request = factory.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [store, { indexes }] of Object.entries(SCHEMA)) {
        const os = db.createObjectStore(store, { keyPath: 'id' });
        for (const index of indexes) os.createIndex(index, index);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the database.'));
    request.onblocked = () => reject(new Error('The database is blocked by another tab. Close other tabs and reload.'));
  });
}

export const wrap = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const finished = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
});

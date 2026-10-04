import { openDatabase } from './db.js';
import { createRepository } from './repository.js';

let repoPromise;

/** Lazily open the app database once. A failed open is not cached, so the user can retry. */
export function getRepo() {
  repoPromise ??= openDatabase().then(createRepository).catch((err) => { repoPromise = undefined; throw err; });
  return repoPromise;
}

/** JSON backup: building one, and (more importantly) validating one that was read from a file.
 *  A backup file is untrusted input. Nothing from it reaches the database except fields that pass these
 *  checks, copied one by one into fresh objects (so unknown keys, including "__proto__", are dropped). */
import { validateProject, validateQuestion, validatePaper, validateEvidence, REVIEW_STATUSES, REVIEW_FIELDS, REVIEW_MAX } from './validation.js';

export const BACKUP_APP = 'se-research-hub';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const MAX_RECORDS = 50000;
export const COLLECTIONS = ['projects', 'researchQuestions', 'papers', 'projectPapers', 'evidenceNotes'];

export function buildBackup(data, now = new Date()) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: Object.fromEntries(COLLECTIONS.map((c) => [c, data[c]])) };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 300;
const dateOk = (v) => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));

/** Validate parsed JSON. Returns { valid, errors[], clean, counts, exportedAt }. `clean` is safe to import. */
export function validateBackup(input) {
  const errors = [];
  const fail = (path, message) => { if (errors.length < 25) errors.push(`${path}: ${message}`); };
  const result = (extra = {}) => ({ valid: errors.length === 0, errors, clean: null, counts: null, exportedAt: null, ...extra });

  if (!isObject(input)) { fail('file', 'is not a backup (expected a JSON object).'); return result(); }
  if (input.app !== BACKUP_APP) { fail('app', `must be "${BACKUP_APP}". This file was not made by this app.`); return result(); }
  if (input.version !== BACKUP_VERSION) { fail('version', `${String(input.version)} is not supported (expected ${BACKUP_VERSION}).`); return result(); }
  if (!isObject(input.data)) { fail('data', 'is missing.'); return result(); }
  const exportedAt = dateOk(input.exportedAt) ? input.exportedAt : null;

  let total = 0;
  for (const name of COLLECTIONS) {
    if (!Array.isArray(input.data[name])) fail(`data.${name}`, 'must be a list.');
    else total += input.data[name].length;
  }
  if (errors.length) return result();
  if (total > MAX_RECORDS) { fail('data', `has ${total} records; the limit is ${MAX_RECORDS}.`); return result(); }

  const clean = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const seen = Object.fromEntries(COLLECTIONS.map((c) => [c, new Set()]));
  const dates = (r, path) => {
    if (!dateOk(r.createdAt)) fail(path, 'createdAt must be an ISO date.');
    if (!dateOk(r.updatedAt)) fail(path, 'updatedAt must be an ISO date.');
    return { createdAt: r.createdAt, updatedAt: r.updatedAt };
  };
  const unique = (name, id, path) => {
    if (!idOk(id)) { fail(path, 'needs a valid id.'); return false; }
    if (seen[name].has(id)) { fail(path, `duplicate id "${String(id).slice(0, 40)}".`); return false; }
    seen[name].add(id);
    return true;
  };
  const merge = (path, validation) => { for (const [k, m] of Object.entries(validation.errors)) fail(`${path}.${k}`, m); return validation.values; };

  input.data.projects.forEach((r, i) => {
    const path = `projects[${i}]`;
    if (!isObject(r)) return fail(path, 'must be an object.');
    if (!unique('projects', r.id, path)) return;
    clean.projects.push({ id: r.id, ...merge(path, validateProject(r)), ...dates(r, path) });
  });

  input.data.researchQuestions.forEach((r, i) => {
    const path = `researchQuestions[${i}]`;
    if (!isObject(r)) return fail(path, 'must be an object.');
    if (!unique('researchQuestions', r.id, path)) return;
    if (!seen.projects.has(r.projectId)) fail(path, 'refers to a project that is not in the file.');
    if (!Number.isInteger(r.position) || r.position < 1 || r.position > 100000) fail(path, 'position must be a whole number from 1.');
    clean.researchQuestions.push({ id: r.id, projectId: r.projectId, ...merge(path, validateQuestion(r)), position: r.position, ...dates(r, path) });
  });

  input.data.papers.forEach((r, i) => {
    const path = `papers[${i}]`;
    if (!isObject(r)) return fail(path, 'must be an object.');
    if (!unique('papers', r.id, path)) return;
    clean.papers.push(merge(path, validatePaper(r)));
  });

  input.data.projectPapers.forEach((r, i) => {
    const path = `projectPapers[${i}]`;
    if (!isObject(r)) return fail(path, 'must be an object.');
    if (!idOk(r.id) || r.id !== `${r.projectId}:${r.paperId}`) return fail(path, 'id must be "projectId:paperId".');
    if (!unique('projectPapers', r.id, path)) return;
    if (!seen.projects.has(r.projectId)) fail(path, 'refers to a project that is not in the file.');
    if (!seen.papers.has(r.paperId)) fail(path, 'refers to a paper that is not in the file.');
    if (!dateOk(r.addedAt)) fail(path, 'addedAt must be an ISO date.');
    const status = r.status ?? 'unread';
    if (!REVIEW_STATUSES.includes(status)) fail(path, 'status must be unread, reading or read.');
    let review = null;
    if (r.review !== null && r.review !== undefined) {
      if (!isObject(r.review)) fail(`${path}.review`, 'must be an object or null.');
      else {
        review = {};
        for (const f of REVIEW_FIELDS) {
          const v = r.review[f] ?? '';
          if (typeof v !== 'string' || v.length > REVIEW_MAX) fail(`${path}.review.${f}`, `must be text of at most ${REVIEW_MAX} characters.`);
          else review[f] = v.trim();
        }
      }
    }
    if (r.reviewedAt !== null && r.reviewedAt !== undefined && !dateOk(r.reviewedAt)) fail(path, 'reviewedAt must be an ISO date or null.');
    clean.projectPapers.push({ id: r.id, projectId: r.projectId, paperId: r.paperId, addedAt: r.addedAt, status, review, reviewedAt: r.reviewedAt ?? null });
  });

  const linkIds = seen.projectPapers;
  const questionProject = new Map(clean.researchQuestions.map((q) => [q.id, q.projectId]));
  input.data.evidenceNotes.forEach((r, i) => {
    const path = `evidenceNotes[${i}]`;
    if (!isObject(r)) return fail(path, 'must be an object.');
    if (!unique('evidenceNotes', r.id, path)) return;
    if (!linkIds.has(`${r.projectId}:${r.paperId}`)) fail(path, 'its paper is not saved in its project in this file.');
    if (questionProject.get(r.researchQuestionId) !== r.projectId) fail(path, 'its research question is missing or belongs to another project.');
    clean.evidenceNotes.push({ id: r.id, ...merge(path, validateEvidence(r)), ...dates(r, path) });
  });

  // Papers nothing links to would be clutter: drop them (they were orphans in the source too).
  const used = new Set(clean.projectPapers.map((l) => l.paperId));
  const before = clean.papers.length;
  clean.papers = clean.papers.filter((p) => used.has(p.id));

  if (errors.length) return result({ exportedAt });
  return result({ clean, exportedAt, counts: countsOf(clean), droppedOrphans: before - clean.papers.length });
}

export const countsOf = (data) => Object.fromEntries(COLLECTIONS.map((c) => [c, data[c].length]));

/** Read backup text (from a file) into a validation result, never throwing. */
export function parseBackupText(text) {
  if (typeof text !== 'string' || text.length === 0) return { valid: false, errors: ['file: is empty.'], clean: null, counts: null, exportedAt: null };
  if (text.length > MAX_BACKUP_BYTES) return { valid: false, errors: [`file: is larger than ${MAX_BACKUP_BYTES / 1024 / 1024} MB.`], clean: null, counts: null, exportedAt: null };
  let parsed;
  try { parsed = JSON.parse(text.replace(/^﻿/, '')); }
  catch { return { valid: false, errors: ['file: is not valid JSON. Choose a backup file made by this app.'], clean: null, counts: null, exportedAt: null }; }
  return validateBackup(parsed);
}

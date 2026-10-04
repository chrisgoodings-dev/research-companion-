import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { openDatabase } from '../../js/db/db.js';
import { createRepository } from '../../js/db/repository.js';
import { buildBackup, validateBackup, parseBackupText, countsOf, BACKUP_APP, MAX_RECORDS } from '../../js/backup.js';
import { csvCell, toCsv, evidenceCsv, matrixCsv, libraryCsv } from '../../js/export.js';

let n = 0;
const freshRepo = async () => createRepository(await openDatabase(`bk-${n++}`, new IDBFactory()));

async function populated() {
  const repo = await freshRepo();
  const p = await repo.projects.create({ name: 'AI-assisted coding', description: 'About "AI", commas, and\nnewlines' });
  const p2 = await repo.projects.create({ name: 'Second project' });
  const q1 = await repo.questions.create(p.id, { text: 'Does AI improve developer productivity?' });
  const q2 = await repo.questions.create(p.id, { text: 'What risks does AI-generated code carry?' });
  const paper = (id, title, extra = {}) => ({ id, title, authors: ['Ada Lovelace', 'Grace Hopper'], year: 2022, venue: 'Journal', doi: '10.1/x', url: 'https://example.org/a', sources: ['openalex'], ...extra });
  await repo.papers.saveToProject(p.id, paper('doi:10.1/x', 'Productivity Assessment'));
  await repo.papers.saveToProject(p2.id, paper('doi:10.1/x', 'Productivity Assessment'));
  await repo.papers.saveToProject(p.id, paper('w2', '=HYPERLINK("http://evil","click")', { doi: '' }));
  await repo.papers.saveReview(p.id, 'doi:10.1/x', { status: 'read', studyAim: 'Aim', keyFindings: 'Findings' });
  await repo.evidence.create({ projectId: p.id, paperId: 'doi:10.1/x', researchQuestionId: q1.id, relationship: 'supports', evidence: 'Faster by 55%.', interpretation: '+cmd|calc', location: 'Table 2', tags: 'speed, productivity' });
  await repo.evidence.create({ projectId: p.id, paperId: 'doi:10.1/x', researchQuestionId: q1.id, relationship: 'contradicts', evidence: 'No gain for experts.' });
  await repo.evidence.create({ projectId: p.id, paperId: 'w2', researchQuestionId: q2.id, relationship: 'mixed', evidence: 'Some "quoted" text, with comma' });
  return { repo, p, p2, q1, q2 };
}

/* ---------------- CSV ---------------- */
test('csvCell escapes quotes, commas and newlines', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(2022), '2022');
});

test('csvCell neutralises spreadsheet formulas (CSV injection)', () => {
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', '\r=x']) assert.ok(csvCell(evil).replace(/^"/, '').startsWith("'"), `${JSON.stringify(evil)} is prefixed`);
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('safe = fine'), 'safe = fine');
});

test('toCsv: BOM, CRLF, header row', () => {
  const csv = toCsv([{ label: 'A', get: (r) => r.a }, { label: 'B, C', get: (r) => r.b }], [{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }]);
  assert.equal(csv, '﻿A,"B, C"\r\n1,x\r\n2,"y,z"\r\n');
});

test('evidenceCsv, libraryCsv and matrixCsv content', async () => {
  const { repo, p } = await populated();
  const data = await repo.exportAll();
  const ev = evidenceCsv(data).split('\r\n');
  assert.equal(ev.length, 5, 'header + 3 rows + trailing newline');
  assert.ok(ev[0].includes('Evidence from the paper'));
  assert.ok(evidenceCsv(data).includes('RQ1') && evidenceCsv(data).includes('RQ2'));
  assert.ok(evidenceCsv(data).includes("'+cmd|calc"), 'formula-like interpretation neutralised');
  assert.ok(evidenceCsv(data).includes('"Some ""quoted"" text, with comma"'));
  const lib = libraryCsv(data);
  assert.ok(lib.includes('Read') && lib.includes('Findings') && lib.includes("'=HYPERLINK"), 'library has status, review text and an escaped formula-like title');
  const m = matrixCsv(data, p.id).split('\r\n');
  assert.ok(m[0].replace(/^\ufeff/, '').startsWith('Paper,Authors,Year,DOI,RQ1: Does AI improve developer productivity?'));
  assert.ok(m.some((l) => l.includes('Supports 1, Contradicts 1')));
  assert.ok(m.some((l) => l.startsWith('ALL PAPERS')));
});

/* ---------------- backup: build + validate ---------------- */
test('a real export validates and round-trips with the same counts', async () => {
  const { repo } = await populated();
  const data = await repo.exportAll();
  const backup = buildBackup(data, new Date('2026-10-05T10:00:00Z'));
  assert.equal(backup.app, BACKUP_APP);
  assert.equal(backup.exportedAt, '2026-10-05T10:00:00.000Z');
  const result = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.deepEqual(result.counts, countsOf(data));
  assert.deepEqual(result.counts, { projects: 2, researchQuestions: 2, papers: 2, projectPapers: 3, evidenceNotes: 3 });
});

test('import into an empty database reproduces the data exactly', async () => {
  const { repo } = await populated();
  const before = await repo.exportAll();
  const result = parseBackupText(JSON.stringify(buildBackup(before)));
  const target = await freshRepo();
  const outcome = await target.importData(result.clean, { mode: 'replace' });
  assert.equal(outcome.added.evidenceNotes, 3);
  const after = await target.exportAll();
  const sort = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, [...v].sort((a, b) => a.id.localeCompare(b.id))]));
  assert.deepEqual(sort(after), sort(before));
});

test('merge keeps existing records and adds only new ones; replace discards what was there', async () => {
  const { repo } = await populated();
  const backup = parseBackupText(JSON.stringify(buildBackup(await repo.exportAll()))).clean;
  const target = await freshRepo();
  const mine = await target.projects.create({ name: 'My own project' });
  const merged = await target.importData(backup, { mode: 'merge' });
  assert.equal(merged.added.projects, 2);
  assert.equal((await target.counts()).projects, 3);
  const again = await target.importData(backup, { mode: 'merge' });
  assert.equal(again.added.projects, 0);
  assert.equal(again.skipped.projects, 2, 'a second merge adds nothing');
  assert.equal((await target.counts()).evidenceNotes, 3, 'no duplicates');
  await target.importData(backup, { mode: 'replace' });
  assert.equal(await target.projects.get(mine.id), undefined, 'replace removed my own project');
  assert.equal((await target.counts()).projects, 2);
});

test('a failed import changes nothing (atomic)', async () => {
  const { repo } = await populated();
  const before = await repo.counts();
  const badClean = { projects: [{ id: 'new-p', name: 'Will not survive', description: '', createdAt: 'x', updatedAt: 'x' }], researchQuestions: [], papers: [], projectPapers: [], evidenceNotes: [{ /* no id: IndexedDB rejects this */ }] };
  await assert.rejects(repo.importData(badClean, { mode: 'replace' }));
  assert.deepEqual(await repo.counts(), before, 'even a replace that failed half way left the old data intact');
});

test('importData rejects an unknown mode', async () => {
  const repo = await freshRepo();
  await assert.rejects(repo.importData({}, { mode: 'overwrite-everything' }), /Unknown import mode/);
});

/* ---------------- hostile / broken files ---------------- */
const good = async () => JSON.parse(JSON.stringify(buildBackup(await (await populated()).repo.exportAll())));
const errorsOf = (obj) => validateBackup(obj).errors.join('\n');

test('not a backup at all', () => {
  assert.equal(validateBackup(null).valid, false);
  assert.equal(validateBackup([]).valid, false);
  assert.equal(validateBackup('text').valid, false);
  assert.match(errorsOf({ app: 'other-app', version: 1, data: {} }), /not made by this app/);
  assert.match(errorsOf({ app: BACKUP_APP, version: 99, data: {} }), /not supported/);
  assert.match(errorsOf({ app: BACKUP_APP, version: 1 }), /data: is missing/);
  assert.match(errorsOf({ app: BACKUP_APP, version: 1, data: { projects: 'nope' } }), /must be a list/);
});

test('parseBackupText never throws and explains problems', () => {
  assert.match(parseBackupText('').errors[0], /empty/);
  assert.match(parseBackupText('{not json').errors[0], /not valid JSON/);
  assert.match(parseBackupText('x'.repeat(21 * 1024 * 1024)).errors[0], /larger than 20 MB/);
  assert.equal(parseBackupText('﻿' + JSON.stringify({ app: 'x' })).valid, false, 'BOM tolerated, content still rejected');
});

test('too many records is refused', async () => {
  const b = await good();
  b.data.papers = Array.from({ length: MAX_RECORDS + 1 }, (_, i) => ({ id: `p${i}` }));
  assert.match(errorsOf(b), /limit is 50000/);
});

test('referential integrity is enforced inside the file', async () => {
  let b = await good();
  b.data.researchQuestions[0].projectId = 'ghost';
  assert.match(errorsOf(b), /researchQuestions\[0\].*project that is not in the file/);
  b = await good();
  b.data.projectPapers[0].paperId = 'ghost';
  assert.match(errorsOf(b), /projectPapers.*(id must be|paper that is not in the file)/);
  b = await good();
  b.data.evidenceNotes[0].researchQuestionId = 'ghost';
  assert.match(errorsOf(b), /evidenceNotes\[0\].*research question is missing/);
  b = await good();
  const other = b.data.projects.find((p) => p.id !== b.data.evidenceNotes[0].projectId).id;
  b.data.evidenceNotes[0].projectId = other;
  assert.match(errorsOf(b), /evidenceNotes\[0\]/, 'evidence that points at a question from another project is refused');
});

test('duplicate ids, bad dates, bad enums and over-long text are refused with a path', async () => {
  let b = await good();
  b.data.projects.push({ ...b.data.projects[0] });
  assert.match(errorsOf(b), /projects\[2\].*duplicate id/);
  b = await good();
  b.data.projects[0].createdAt = 'yesterday';
  assert.match(errorsOf(b), /projects\[0\].*createdAt/);
  b = await good();
  b.data.evidenceNotes[0].relationship = 'maybe';
  assert.match(errorsOf(b), /evidenceNotes\[0\]\.relationship/);
  b = await good();
  b.data.projectPapers.find((l) => l.review).review.notes = 'n'.repeat(2001);
  assert.match(errorsOf(b), /review\.notes.*2000/);
  b = await good();
  b.data.projectPapers[0].status = 'finished';
  assert.match(errorsOf(b), /status must be/);
  b = await good();
  b.data.researchQuestions[0].position = -1;
  assert.match(errorsOf(b), /position/);
});

test('errors are capped so a huge bad file cannot flood the page', async () => {
  const b = await good();
  b.data.projects = Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, name: '' }));
  assert.ok(validateBackup(b).errors.length <= 25);
});

test('unknown fields, __proto__ keys and unsafe URLs are stripped, never imported', async () => {
  const b = await good();
  b.data.projects[0].isAdmin = true;
  b.data.papers[0].url = 'javascript:alert(1)';
  b.data.papers[0].extra = { nested: 'x' };
  const text = JSON.stringify(b).replace('"app"', '"__proto__":{"polluted":true},"app"');
  const r = parseBackupText(text);
  assert.equal(r.valid, true, r.errors.join('\n'));
  assert.equal('isAdmin' in r.clean.projects[0], false);
  assert.equal('extra' in r.clean.papers[0], false);
  assert.equal(r.clean.papers[0].url === '' || r.clean.papers[0].url.startsWith('https'), true);
  assert.equal({}.polluted, undefined, 'Object.prototype untouched');
});

test('markup in imported text is kept as plain text (escaping happens on render)', async () => {
  const b = await good();
  b.data.projects[0].name = '<img src=x onerror=alert(1)>';
  const r = validateBackup(b);
  assert.equal(r.valid, true);
  assert.equal(r.clean.projects[0].name, '<img src=x onerror=alert(1)>');
});

test('orphan papers (no project links to them) are dropped', async () => {
  const b = await good();
  b.data.papers.push({ id: 'orphan', title: 'Nobody saved me', authors: [], year: null, sources: [] });
  const r = validateBackup(b);
  assert.equal(r.valid, true);
  assert.equal(r.droppedOrphans, 1);
  assert.equal(r.clean.papers.some((p) => p.id === 'orphan'), false);
});

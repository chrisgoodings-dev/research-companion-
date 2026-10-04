// Stage 9: backup (JSON), restore (validation, merge/replace, atomic), CSV exports, hostile files.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

const counts = () => page.evaluate(async () => { const { getRepo } = await import('/js/db/index.js'); return (await getRepo()).counts(); });
const file = (name, content) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)) });

// ---------- empty state ----------
await page.goto(`${base}#/backup`);
await page.waitForSelector('#bk-download');
check((await page.textContent('#bk-counts')).includes('0 projects'), 'empty backup page shows zero counts');
check((await page.textContent('#bk-last')).includes('not downloaded a backup yet'), 'says no backup has been made');
check(await page.locator('#csv-matrix').isDisabled(), 'matrix CSV is disabled when there are no projects');
await axe(page, 'backup page (empty)');

// ---------- seed ----------
await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const A = await repo.projects.create({ name: 'AI-assisted coding', description: 'Has "quotes", commas, and <b>markup</b>' });
  const rq1 = await repo.questions.create(A.id, { text: 'Does AI improve developer productivity?' });
  await repo.papers.saveToProject(A.id, { id: 'doi:10.1/x', title: 'Productivity Assessment', authors: ['Ada Lovelace'], year: 2022, doi: '10.1/x', url: 'https://example.org/a', sources: ['openalex'] });
  await repo.papers.saveToProject(A.id, { id: 'w2', title: '=HYPERLINK("http://evil.example","click")', authors: ['B'], year: 2023, sources: [] });
  await repo.papers.saveReview(A.id, 'doi:10.1/x', { status: 'read', studyAim: 'Aim', keyFindings: 'Findings' });
  await repo.evidence.create({ projectId: A.id, paperId: 'doi:10.1/x', researchQuestionId: rq1.id, relationship: 'supports', evidence: 'Faster by 55%.', interpretation: '+cmd|calc', tags: 'speed' });
  await repo.evidence.create({ projectId: A.id, paperId: 'w2', researchQuestionId: rq1.id, relationship: 'contradicts', evidence: 'Line one\nLine "two", with comma' });
});
await page.reload();
await page.waitForSelector('#bk-download');
check((await page.textContent('#bk-counts')).includes('1 project') && (await page.textContent('#bk-counts')).includes('2 evidence records'), 'counts reflect stored data');
await axe(page, 'backup page (with data)');
await page.screenshot({ path: join(shots, 'backup-desktop.png'), fullPage: true });

// ---------- JSON backup download ----------
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bk-download')]);
check(/^se-research-hub-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), `download is named ${dl.suggestedFilename()}`);
const backupPath = await dl.path();
const backupText = await readFile(backupPath, 'utf8');
const backup = JSON.parse(backupText);
check(backup.app === 'se-research-hub' && backup.version === 1 && Object.keys(backup.data).length === 5, 'backup has the expected envelope');
check(backup.data.evidenceNotes.length === 2 && backup.data.projects[0].description.includes('<b>markup</b>'), 'backup contains the data, markup kept as text');
await page.waitForFunction(() => document.querySelector('#bk-last').textContent.includes('Last backup downloaded'));
check(true, 'last-backup date is shown after downloading');

// ---------- CSV downloads ----------
let [d] = await Promise.all([page.waitForEvent('download'), page.click('#csv-evidence')]);
let csv = await readFile(await d.path(), 'utf8');
check(csv.startsWith('﻿Project,Research question'), 'evidence CSV starts with a BOM and headers');
check(csv.includes('"Line one\nLine ""two"", with comma"'), 'newlines, quotes and commas are escaped');
check(csv.includes("'+cmd|calc"), 'formula-like interpretation is neutralised');
[d] = await Promise.all([page.waitForEvent('download'), page.click('#csv-library')]);
csv = await readFile(await d.path(), 'utf8');
check(csv.includes(`"'=HYPERLINK(""http://evil.example"",""click"")"`), 'formula in a paper title is neutralised in the library CSV');
check(csv.includes('Read') && csv.includes('Findings'), 'library CSV has status and review text');
[d] = await Promise.all([page.waitForEvent('download'), page.click('#csv-matrix')]);
csv = await readFile(await d.path(), 'utf8');
check(csv.includes('RQ1: Does AI improve developer productivity?') && csv.includes('Supports 1') && csv.includes('Contradicts 1'), 'matrix CSV has the question column and relationship counts');

// ---------- restore: bad files ----------
const result = page.locator('#rs-result');
await page.setInputFiles('#rs-file', file('notes.json', 'this is not json'));
await page.waitForSelector('#rs-result [role=alert]');
check((await result.textContent()).includes('not valid JSON') && (await result.textContent()).includes('Nothing was changed'), 'non-JSON file refused with an explanation');
check(await page.locator('#rs-form').count() === 0, 'no restore form for an invalid file');
await axe(page, 'restore error');
await page.screenshot({ path: join(shots, 'backup-restore-error.png') });

await page.setInputFiles('#rs-file', file('other.json', { app: 'some-other-app', version: 1, data: {} }));
await page.waitForFunction(() => document.querySelector('#rs-result').textContent.includes('not made by this app'));
check(true, 'a file from another app is refused');

const broken = JSON.parse(backupText);
broken.data.evidenceNotes[0].researchQuestionId = 'ghost';
broken.data.projects[0].createdAt = 'yesterday';
await page.setInputFiles('#rs-file', file('broken.json', broken));
await page.waitForFunction(() => document.querySelector('#rs-result').textContent.includes('evidenceNotes[0]'));
const msg = await result.textContent();
check(msg.includes('projects[0]') && msg.includes('createdAt') && msg.includes('evidenceNotes[0]'), 'errors name the exact record and field');
check((await result.locator('li').count()) >= 2, 'all problems are listed, not just the first');
check(JSON.stringify(await counts()) === JSON.stringify({ projects: 1, researchQuestions: 1, papers: 2, evidenceNotes: 2 }), 'a refused file changed nothing');

// ---------- restore: valid file, merge ----------
await page.setInputFiles('#rs-file', file('good.json', backupText));
await page.waitForSelector('#rs-form');
check((await result.textContent()).includes('is valid') && (await result.textContent()).includes('2 evidence records'), 'valid file shows a preview of its contents');
check((await page.locator('#mode-merge').isChecked()) && !(await page.locator('#mode-replace').isChecked()), 'Merge (the safe option) is the default');
await axe(page, 'restore preview');
await page.screenshot({ path: join(shots, 'backup-restore-preview.png'), fullPage: true });
await page.click('#rs-form button[type=submit]');
await page.waitForSelector('#rs-result [role=status]');
check((await result.textContent()).includes('0 records added') && (await result.textContent()).includes('already present'), 'merging a backup you already have adds nothing and duplicates nothing');
check((await counts()).projects === 1, 'still one project');

// ---------- wipe, then replace-restore (round trip) ----------
await page.evaluate(async () => { const { getRepo } = await import('/js/db/index.js'); await (await getRepo()).importData({ projects: [], researchQuestions: [], papers: [], projectPapers: [], evidenceNotes: [] }, { mode: 'replace' }); });
check((await counts()).projects === 0, 'database wiped');
await page.setInputFiles('#rs-file', file('good.json', backupText));
await page.waitForSelector('#rs-form');
await page.check('#mode-replace');
await page.click('#rs-form button[type=submit]');
await page.waitForFunction(() => document.querySelector('#confirm-dialog').open);
check(true, 'Replace asks for confirmation');
check((await page.textContent('#confirm-body')).includes('cannot be undone'), 'and says it cannot be undone');
check(await page.evaluate(() => document.activeElement.textContent.trim() === 'Cancel'), 'Cancel is focused');
await page.click('#confirm-dialog button[value=cancel]');
check((await counts()).projects === 0, 'cancelling the confirmation changed nothing');
await page.click('#rs-form button[type=submit]');
await page.click('#confirm-ok');
await page.waitForSelector('#rs-result [role=status]');
check((await result.textContent()).includes('matches the backup'), 'replace reports success');
const restored = await page.evaluate(async () => { const { getRepo } = await import('/js/db/index.js'); return (await getRepo()).exportAll(); });
check(JSON.stringify(restored.evidenceNotes.map((e) => e.id).sort()) === JSON.stringify(backup.data.evidenceNotes.map((e) => e.id).sort()) && restored.projects[0].name === 'AI-assisted coding', 'restored data equals the backup (round trip)');
check((await page.textContent('#bk-counts')).includes('2 evidence records'), 'counts on the page refreshed');

// restored data is usable in the app
await page.goto(`${base}#/library`);
await page.waitForSelector('.lib-item');
check((await page.locator('.lib-item').count()) === 2, 'restored papers appear in the Library');
await page.goto(`${base}#/projects`);
await page.waitForSelector('.project-card');
check((await page.textContent('.project-card')).includes('<b>markup</b>'), 'markup restored as plain text, not rendered');

// ---------- hostile file ----------
await page.goto(`${base}#/backup`);
await page.waitForSelector('#rs-file');
const hostile = JSON.parse(backupText);
hostile.data.projects[0].name = '<img src=x onerror="window.__xss=1">';
hostile.data.projects[0].isAdmin = true;
hostile.data.papers[0].url = 'javascript:alert(1)';
await page.setInputFiles('#rs-file', { name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(hostile).replace('"app"', '"__proto__":{"polluted":true},"app"')) });
await page.waitForSelector('#rs-form');
await page.check('#mode-replace');
await page.click('#rs-form button[type=submit]');
await page.click('#confirm-ok');
await page.waitForSelector('#rs-result [role=status]');
await page.goto(`${base}#/projects`);
await page.waitForSelector('.project-card');
check((await page.locator('.project-card img').count()) === 0 && await page.evaluate(() => window.__xss === undefined && ({}).polluted === undefined), 'hostile names and __proto__ keys are inert');
const kept = await page.evaluate(async () => { const { getRepo } = await import('/js/db/index.js'); const d = await (await getRepo()).exportAll(); return { admin: 'isAdmin' in d.projects[0], url: d.papers[0].url }; });
check(kept.admin === false && !kept.url.startsWith('javascript:'), 'unknown fields dropped and unsafe URLs blanked before storing');

// ---------- navigation + dashboard ----------
await page.goto(`${base}#/dashboard`);
await page.waitForSelector('#backup-note');
await page.waitForFunction(() => document.querySelector('#backup-note').textContent.includes('Last backup'));
check(true, 'dashboard reminds you when the last backup was made');
check((await page.locator('.nav__footer').isVisible()) && (await page.getAttribute('.nav__footer', 'href')) === '#/backup', 'sidebar has a Backup & export link on desktop');
check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- mobile ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.goto(`${base}#/backup`);
await m.waitForSelector('#rs-file');
check(await m.locator('.nav__footer').isHidden(), 'mobile: sidebar footer link is hidden (the Menu sheet has it)');
await m.click('#menu-btn');
check((await m.locator('#more-menu a[href="#/backup"]').count()) === 1, 'mobile: Menu sheet links to Backup & export');
await m.keyboard.press('Escape');
await m.setInputFiles('#rs-file', { name: 'long.json', mimeType: 'application/json', buffer: Buffer.from('x'.repeat(30)) });
await m.waitForSelector('#rs-result [role=alert]');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: backup page does not scroll sideways');
await m.screenshot({ path: join(shots, 'backup-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark backup page');

await finish();

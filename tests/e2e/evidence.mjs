// Stage 7: evidence records (form, validation, add/edit/delete), project switching, Evidence page, cascades.
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

// ---------- empty Evidence page ----------
await page.goto(`${base}#/evidence`);
await page.waitForSelector('.empty-state');
check((await page.textContent('.empty-state')).includes('No evidence recorded yet'), 'empty Evidence page explains how to start');
await axe(page, 'evidence page (empty)');

// ---------- seed ----------
const ids = await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const A = await repo.projects.create({ name: 'AI-assisted coding' });
  const B = await repo.projects.create({ name: 'Security review' });
  const rq1 = await repo.questions.create(A.id, { text: 'Does AI code generation improve developer productivity?' });
  const rq2 = await repo.questions.create(A.id, { text: 'What risks does AI-generated code introduce?' });
  const mk = (id, title) => ({ id, title, authors: ['Ada Lovelace'], year: 2022, venue: 'Journal', sources: ['openalex'], url: 'https://example.org/p' });
  await repo.papers.saveToProject(A.id, mk('p1', 'Productivity Assessment of Neural Code Completion'));
  await repo.papers.saveToProject(B.id, mk('p1', 'Productivity Assessment of Neural Code Completion'));
  await repo.papers.saveToProject(A.id, mk('p2', 'Security Weaknesses of Copilot'));
  return { A: A.id, B: B.id, rq1: rq1.id, rq2: rq2.id };
});

// ---------- Evidence tab: validation ----------
await page.goto(`${base}#/library/p1?tab=evidence&project=${ids.A}`);
await page.reload();
await page.waitForSelector('#ev-add');
check(await page.locator('#panel-evidence').isVisible() && (await page.getAttribute('#tab-evidence', 'aria-selected')) === 'true', 'URL opens the Evidence tab');
check((await page.locator('#ev-new-rq option').count()) === 3, 'question select lists both questions plus a prompt');
check((await page.locator('#ev-new-rq option >> nth=1').textContent()).startsWith('RQ1: Does AI code generation'), 'options are labelled RQ1, RQ2…');
check((await page.locator('input[name=ev-new-rel]:checked').count()) === 0, 'no relationship is pre-selected (forces a deliberate choice)');
check((await page.locator('input[name=ev-new-rel]').count()) === 5, 'five relationship options');
await axe(page, 'evidence tab (empty form)');
await page.screenshot({ path: join(shots, 'evidence-form-desktop.png'), fullPage: true });

await page.click('#ev-add button[type=submit]');
check(await page.evaluate(() => document.activeElement.id === 'ev-new-rq'), 'empty submit focuses the first invalid field');
check((await page.textContent('#ev-new-rq-error')).includes('Choose research question'), 'question error says "Choose" for a select');
check((await page.textContent('#ev-new-rel-supports-error')).includes('Choose how this evidence relates'), 'relationship group error shown');
check((await page.textContent('#ev-new-evidence-error')).includes('Enter evidence from the paper'), 'evidence error shown');
check((await page.getAttribute('#ev-new-rel-supports', 'aria-invalid')) === 'true', 'relationship group flagged with aria-invalid');
await axe(page, 'evidence tab (validation errors)');
await page.screenshot({ path: join(shots, 'evidence-validation-error.png') });
await page.selectOption('#ev-new-rq', { index: 1 });
await page.check('#ev-new-rel-contradicts');
await page.fill('#ev-new-evidence', 'x');
await page.fill('#ev-new-tags', Array.from({ length: 11 }, (_, i) => `t${i}`).join(', '));
await page.click('#ev-add button[type=submit]');
check((await page.textContent('#ev-new-tags-error')).includes('at most 10'), 'too many tags rejected');
check((await page.locator('#ev-new-rq-error').isHidden()) && (await page.locator('#ev-new-evidence-error').isHidden()), 'fixed fields lose their errors');

// ---------- add evidence ----------
await page.selectOption('#ev-new-rq', { index: 1 });
await page.check('#ev-new-rel-supports');
await page.fill('#ev-new-evidence', 'Developers using the tool completed the task 55% faster (n=95).');
await page.fill('#ev-new-interpretation', 'Strong effect, but a single small lab task.');
await page.fill('#ev-new-location', 'Table 2');
await page.fill('#ev-new-tags', 'Productivity,  Speed , productivity');
await page.click('#ev-add button[type=submit]');
await page.waitForSelector('.ev');
check((await page.locator('.ev').count()) === 1 && (await page.textContent('#ev-list-h')).includes('(1)'), 'record added and counted');
const card = page.locator('.ev').first();
check((await card.locator('.rel').textContent()).includes('Supports'), 'relationship shown as text');
check((await card.locator('.rel__icon').getAttribute('aria-hidden')) === 'true', 'relationship symbol is decorative (text carries the meaning)');
check((await card.locator('dt').allTextContents()).join('|') === 'From the paper|Your interpretation|Where', 'evidence and interpretation are separate labelled blocks');
check((await card.locator('.ev__block--mine dd').textContent()).startsWith('Strong effect'), 'interpretation kept apart from the evidence');
check((await card.locator('.chip').allTextContents()).join(',') === 'productivity,speed', 'tags normalised and de-duplicated');
check((await card.locator('.badge').textContent()) === 'RQ1', 'record is tied to RQ1');
check(await page.evaluate(() => document.activeElement.id === 'ev-new-rq'), 'focus returns to the form for the next entry');
check((await page.locator('#ev-new-rq').inputValue()) === '' && (await page.locator('input[name=ev-new-rel]:checked').count()) === 0, 'form is cleared after saving');
check((await page.locator('.toast', { hasText: 'Evidence added' }).count()) >= 1, 'confirmation shown');

// second record, no interpretation; hostile text
await page.selectOption('#ev-new-rq', { index: 2 });
await page.check('#ev-new-rel-contradicts');
await page.fill('#ev-new-evidence', 'More defects <img src=x onerror="window.__xss=1"> in generated code.');
await page.click('#ev-add button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.ev').length === 2);
check((await page.locator('.ev').first().locator('.ev__block--mine').count()) === 0, 'no interpretation block when none was written');
check((await page.locator('.ev img').count()) === 0 && await page.evaluate(() => window.__xss === undefined), 'markup in evidence text is not injected or executed');
check((await page.locator('.ev').first().textContent()).includes('<img src=x'), 'hostile text is displayed literally');
await axe(page, 'evidence tab (two records)');
await page.screenshot({ path: join(shots, 'evidence-tab-desktop.png'), fullPage: true });

// ---------- edit ----------
await page.click('.ev >> nth=1 >> [data-ev-edit]');
check(await page.evaluate(() => document.activeElement.tagName === 'SELECT'), 'Edit moves focus into the form');
check((await page.locator('.ev form input[name$="-rel"]:checked').getAttribute('value')) === 'supports', 'edit form shows the stored relationship');
check((await page.locator('.ev form input[name$="-tags"]').inputValue()) === 'productivity, speed', 'edit form shows tags');
await axe(page, 'evidence tab (editing)');
await page.check('.ev form input[value=mixed]');
await page.selectOption('.ev form select', { index: 2 });
await page.click('.ev form button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.ev form').length === 0);
const edited = page.locator('.ev', { hasText: '55% faster' });
check((await edited.locator('.rel').textContent()).includes('Mixed') && (await edited.locator('.badge').textContent()) === 'RQ2', 'edit changed relationship and question');
check(await page.evaluate(() => document.activeElement.hasAttribute('data-ev-edit')), 'focus returns to an Edit button after saving');
await page.click('.ev >> nth=0 >> [data-ev-edit]');
await page.fill('.ev form textarea >> nth=0', '');
await page.click('.ev form button[type=submit]');
check((await page.locator('.ev form .field__error:not([hidden])').count()) >= 1, 'edit form validates too');
await page.click('[data-cancel-edit]');
await page.waitForFunction(() => document.querySelectorAll('.ev form').length === 0);
check((await page.locator('.ev form').count()) === 0 && (await page.locator('.ev').count()) === 2, 'Cancel discards the edit');

// ---------- delete ----------
await page.click('.ev >> nth=0 >> [data-ev-delete]');
check(await page.evaluate(() => document.activeElement.textContent.trim() === 'Cancel'), 'delete confirmation focuses Cancel');
await page.click('#confirm-dialog button[value=cancel]');
check((await page.locator('.ev').count()) === 2, 'cancelling keeps the record');
await page.click('.ev >> nth=0 >> [data-ev-delete]');
await page.click('#confirm-ok');
await page.waitForFunction(() => document.querySelectorAll('.ev').length === 1);
check(await page.evaluate(() => document.activeElement.id === 'ev-list-h'), 'focus moves to the list heading after deleting');

// add one back so later checks have two
await page.selectOption('#ev-new-rq', { index: 2 });
await page.check('#ev-new-rel-contextual');
await page.fill('#ev-new-evidence', 'Background on how acceptance rate is measured.');
await page.fill('#ev-new-tags', 'method');
await page.click('#ev-add button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.ev').length === 2);

// ---------- persistence ----------
await page.reload();
await page.waitForSelector('.ev');
check((await page.locator('.ev').count()) === 2, 'evidence survives reload');

// ---------- project switching ----------
check((await page.locator('#paper-project option').count()) === 2, 'paper is in two projects, so a picker is shown');
await page.fill('#ev-new-evidence', 'unsaved text');
await page.selectOption('#paper-project', ids.B);
check(await page.locator('#confirm-dialog').evaluate((d) => d.open), 'switching with unsaved evidence text asks first');
await page.click('#confirm-dialog button[value=cancel]');
await page.waitForFunction((a) => document.querySelector('#paper-project').value === a, ids.A);
check((await page.locator('#ev-new-evidence').inputValue()) === 'unsaved text', 'cancel keeps the unsaved text');
await page.fill('#ev-new-evidence', '');   // typed then deleted: not dirty any more
await page.selectOption('#paper-project', ids.B);
await page.waitForSelector('#panel-evidence .empty-state');
check((await page.textContent('#panel-evidence')).includes('Add a research question first'), 'a project without research questions explains what to do');
check((await page.locator('#panel-evidence a[href$="' + ids.B + '"]').count()) === 1, 'and links to that project');
check((await page.locator('.ev').count()) === 0, 'evidence from the other project is not shown');
await axe(page, 'evidence tab (project without questions)');
await page.selectOption('#paper-project', ids.A);
await page.waitForSelector('.ev');
check((await page.locator('.ev').count()) === 2, 'switching back shows this project\'s evidence');

// ---------- Evidence page ----------
await page.goto(`${base}#/evidence`);
await page.waitForSelector('.ev');
check((await page.locator('.ev').count()) === 2, 'Evidence page lists both records');
check((await page.textContent('#ef-breakdown')).includes('Mixed 1') && (await page.textContent('#ef-breakdown')).includes('Contextual 1'), 'relationship totals shown as text');
check((await page.locator('.ev >> nth=0 >> .badge').textContent()).startsWith('AI-assisted coding · RQ'), 'cards say which project and question');
check((await page.locator('.ev__paper a').first().getAttribute('href')).includes('tab=evidence'), 'each card links to its paper’s Evidence tab');
await axe(page, 'evidence page');
await page.screenshot({ path: join(shots, 'evidence-page-desktop.png'), fullPage: true });

await page.selectOption('#ef-rel', 'mixed');
check((await page.locator('.ev').count()) === 1 && page.url().includes('rel=mixed'), 'relationship filter (kept in URL)');
await page.selectOption('#ef-rel', 'any');
await page.selectOption('#ef-tag', 'method');
check((await page.locator('.ev').count()) === 1 && (await page.textContent('.ev')).includes('acceptance rate'), 'tag filter');
await page.selectOption('#ef-tag', 'any');
check((await page.locator('#ef-question optgroup').count()) === 2, 'question select is grouped by project');
await page.selectOption('#ef-question', ids.rq1);
check((await page.locator('.ev').count()) === 0, 'question filter with no records shows the empty message');
check((await page.textContent('#ef-results')).includes('No evidence matches'), 'no-match message');
await axe(page, 'evidence page (no matches)');
await page.click('#ef-clear');
check((await page.locator('.ev').count()) === 2 && await page.evaluate(() => document.activeElement.id === 'ef-q'), 'Clear filters restores all and focuses the keyword box');
await page.fill('#ef-q', 'ACCEPTANCE');
check((await page.locator('.ev').count()) === 1, 'keyword filter');
await page.fill('#ef-q', 'productivity assessment');
check((await page.locator('.ev').count()) === 2, 'keyword also matches the paper title');
await page.fill('#ef-q', '');
await page.selectOption('#ef-project', ids.A);
check((await page.locator('#ef-question optgroup').count()) === 1, 'choosing a project narrows the question list');
await page.reload();
await page.waitForSelector('.ev');
check((await page.locator('#ef-project').inputValue()) === ids.A, 'reload restores filters from the URL');

// link from a card to the paper tab
await page.click('.ev__paper a >> nth=0');
await page.waitForSelector('#ev-add');
check(await page.locator('#panel-evidence').isVisible(), 'card link opens the paper’s Evidence tab');

// ---------- project page shows counts per question ----------
await page.goto(`${base}#/projects/${ids.A}`);
await page.waitForSelector('.rq');
check((await page.textContent('.rq >> nth=1')).includes('2 evidence records'), 'RQ2 shows its evidence count');
check((await page.textContent('.rq >> nth=0')).includes('No evidence recorded yet'), 'RQ1 says none yet');
await page.click('.rq >> nth=1 >> a:has-text("evidence records")');
await page.waitForSelector('.ev');
check(page.url().includes('rq=') && (await page.locator('.ev').count()) === 2, 'count links to the Evidence page filtered to that question');

// ---------- cascade through the UI ----------
await page.goto(`${base}#/projects/${ids.A}`);
await page.waitForSelector('.rq');
await page.click('.rq >> nth=1 >> [data-action=delete]');
await page.click('#confirm-ok');
await page.waitForFunction(() => document.querySelectorAll('.rq').length === 1);
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=evidenceNotes]').textContent !== '–');
check((await page.textContent('[data-stat=evidenceNotes]')) === '0', 'deleting a research question deleted its evidence (dashboard count)');

check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- mobile + dark ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.goto(`${base}#/dashboard`);
const mid = await m.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const p = await repo.projects.create({ name: 'Mobile project with a fairly long name' });
  const q = await repo.questions.create(p.id, { text: 'Does the layout reflow at 320 pixels wide for long questions?' });
  await repo.papers.saveToProject(p.id, { id: 'm1', title: 'A_title_with_a_very_long_unbroken_segment_to_test_reflow_on_small_screens', authors: ['A'], sources: [] });
  await repo.evidence.create({ projectId: p.id, paperId: 'm1', researchQuestionId: q.id, relationship: 'mixed', evidence: 'https://example.org/a/very/long/url/without/breaks/that/could/overflow/the/screen/at/320px', interpretation: 'Mine.', location: 'Section 4.2', tags: 'one, two' });
  return p.id;
});
await m.goto(`${base}#/library/m1?tab=evidence`);
await m.reload();
await m.waitForSelector('.ev');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: evidence tab does not scroll horizontally');
check(await m.evaluate(() => { const list = document.querySelector('[role=tablist]'); const last = [...list.querySelectorAll('[role=tab]')].at(-1).getBoundingClientRect(); return list.scrollWidth <= list.clientWidth && last.right <= window.innerWidth; }), 'mobile 320px: all three tabs are fully visible (no hidden scrolling tab bar)');
await m.screenshot({ path: join(shots, 'evidence-tab-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark evidence tab');
await m.goto(`${base}#/evidence`);
await m.waitForSelector('.ev');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: Evidence page does not scroll horizontally');
await axe(m, 'mobile dark evidence page');

await finish();

// Stage 3: projects and research questions (forms, validation, persistence, delete cascade, a11y).
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${base}#/projects`);
await page.waitForSelector('#new-project');
check((await page.textContent('#view-body')).includes('No projects yet'), 'empty state shown on first visit');
await axe(page, 'projects list (empty)');

// --- Validation: empty submit
await page.click('#new-project button[type=submit]');
check(await page.evaluate(() => document.activeElement.id === 'new-name'), 'invalid submit focuses first invalid field');
check((await page.getAttribute('#new-name', 'aria-invalid')) === 'true', 'invalid field has aria-invalid');
check((await page.textContent('#new-name-error')).includes('Enter project name'), 'error message is specific');
check((await page.getAttribute('#new-name', 'aria-describedby')).includes('new-name-error'), 'error is linked via aria-describedby');
await axe(page, 'projects list (with error shown)');
await page.screenshot({ path: join(shots, 'projects-validation-error.png') });

// Whitespace-only and too-short are rejected
await page.fill('#new-name', '     ');
await page.click('#new-project button[type=submit]');
check((await page.textContent('#new-name-error')).includes('Enter project name'), 'whitespace-only name rejected');
await page.fill('#new-name', 'ab');
check((await page.textContent('#new-name-error')).includes('at least 3'), 'error updates live while typing');
check((await page.textContent('[data-counter-for=new-name]')).trim() === '2 / 80', 'character counter updates');

// --- Create a project (navigates to detail)
await page.fill('#new-name', 'AI-assisted coding');
await page.fill('#new-description', 'Does AI help developers? <b>not bold</b>');
await page.click('#new-project button[type=submit]');
await page.waitForSelector('#add-rq');
check((await page.textContent('h1')) === 'AI-assisted coding', 'project created; detail page shows its name');
check((await page.title()).startsWith('AI-assisted coding'), 'document title reflects the project');
check(await page.locator('#proj-description').inputValue() === 'Does AI help developers? <b>not bold</b>', 'description round-trips as text (no HTML injection)');
check((await page.locator('.toast').first().textContent()).includes('created'), 'confirmation toast shown');

// --- Research questions
await page.click('#add-rq button[type=submit]');
check((await page.textContent('#rq-new-error')).includes('Enter research question'), 'empty question rejected');
await page.fill('#rq-new', 'Too short');
await page.click('#add-rq button[type=submit]');
check((await page.textContent('#rq-new-error')).includes('at least 10'), 'short question rejected');
await page.fill('#rq-new', 'Does AI code generation improve developer productivity?');
await page.click('#add-rq button[type=submit]');
await page.waitForSelector('.rq');
check(await page.evaluate(() => document.activeElement.id === 'rq-new'), 'focus returns to the add-question field after saving');
await page.fill('#rq-new', 'What risks does AI-generated code introduce?');
await page.click('#add-rq button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.rq').length === 2);
const labels = await page.locator('.rq__num').allTextContents();
check(labels.join() === 'RQ1,RQ2', `questions numbered ${labels.join(', ')}`);
await axe(page, 'project detail');
await page.screenshot({ path: join(shots, 'project-detail-desktop.png'), fullPage: true });

// --- Edit a question inline
await page.click('[data-action=edit] >> nth=0');
check(await page.evaluate(() => document.activeElement.tagName === 'TEXTAREA'), 'edit moves focus into the textarea');
await axe(page, 'project detail (editing a question)');
await page.fill('#edit-rq textarea', 'Does AI code generation measurably improve productivity?');
await page.click('#edit-rq button[type=submit]');
await page.waitForFunction(() => document.querySelector('.rq__text').textContent.includes('measurably'));
check(await page.evaluate(() => document.activeElement.dataset.action === 'edit'), 'focus returns to the Edit button after saving');
// Cancel keeps text
await page.click('[data-action=edit] >> nth=1');
await page.fill('#edit-rq textarea', 'a different but unsaved wording here');
await page.click('#cancel-edit');
check(!(await page.locator('.rq__text >> nth=1').textContent()).includes('unsaved'), 'cancel discards edits');

// --- Persistence across reload
await page.reload();
await page.waitForSelector('.rq');
check((await page.locator('.rq').count()) === 2, 'data persists after reload (IndexedDB)');
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=projects]').textContent !== '–');
check((await page.textContent('[data-stat=projects]')) === '1' && (await page.textContent('[data-stat=researchQuestions]')) === '2', 'dashboard counts reflect stored data');

// --- Project list shows it; delete a question with confirmation
await page.goto(`${base}#/projects`);
await page.waitForSelector('.project-card');
check((await page.textContent('.project-card__meta')).includes('2 research questions'), 'list shows question count');
await axe(page, 'projects list (one project)');
await page.click('.project-card a');
await page.waitForSelector('.rq');
await page.click('[data-action=delete] >> nth=0');
check(await page.locator('#confirm-dialog').evaluate((d) => d.open), 'delete asks for confirmation');
check(await page.evaluate(() => document.activeElement.textContent.trim() === 'Cancel'), 'confirm dialog focuses Cancel, not the destructive action');
await axe(page, 'confirm dialog open');
await page.click('#confirm-dialog button[value=cancel]');
check((await page.locator('.rq').count()) === 2, 'cancelling keeps the question');
await page.click('[data-action=delete] >> nth=0');
await page.click('#confirm-ok');
await page.waitForFunction(() => document.querySelectorAll('.rq').length === 1);
check((await page.locator('.rq__num').textContent()) === 'RQ1', 'remaining question renumbered');
check(await page.evaluate(() => document.activeElement.id === 'rq-h'), 'focus moves to the list heading after delete');

// --- Delete project (cascade)
await page.click('#delete-project');
await page.keyboard.press('Escape');
check((await page.locator('#delete-project').count()) === 1, 'Esc cancels the confirmation');
await page.click('#delete-project');
await page.click('#confirm-ok');
await page.waitForSelector('#new-project');
check(page.url().endsWith('#/projects'), 'returns to project list after deleting');
check((await page.textContent('#view-body')).includes('No projects yet'), 'project removed');
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=projects]').textContent !== '–');
check((await page.textContent('[data-stat=researchQuestions]')) === '0', 'questions cascaded away with the project');

// --- Unknown project id
await page.goto(`${base}#/projects/does-not-exist`);
await page.waitForFunction(() => document.querySelector('h1').textContent === 'Project not found');
check(true, 'unknown project id shows a not-found message');

check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// --- Mobile layout of the forms
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2 })).newPage();
await m.goto(`${base}#/projects`);
await m.waitForSelector('#new-project');
await m.fill('#new-name', 'Mobile project');
await m.click('#new-project button[type=submit]');
await m.waitForSelector('#add-rq');
await m.fill('#rq-new', 'Does the layout reflow at 320 pixels wide?');
await m.click('#add-rq button[type=submit]');
await m.waitForSelector('.rq');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: forms and lists do not scroll horizontally');
await m.screenshot({ path: join(shots, 'project-detail-mobile.png'), fullPage: true });
await axe(m, 'mobile project detail');

await finish();

// Stage 5: two sources merged by DOI, partial failures, sources validation, saving papers to projects.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const read = async (f) => JSON.parse(await readFile(`tests/fixtures/${f}`, 'utf8'));
const openalex = await read('openalex-works.json');
const crossref = await read('crossref-works.json');
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

const seen = { openalex: [], crossref: [] };
let crossrefMode = 'ok';
await page.route('https://api.openalex.org/**', (r) => { seen.openalex.push(new URL(r.request().url())); return r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(openalex) }); });
await page.route('https://api.crossref.org/**', (r) => {
  seen.crossref.push(new URL(r.request().url()));
  if (crossrefMode === 'down') return r.fulfill({ status: 503, headers: CORS, body: '{}' });
  return r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(crossref) });
});

// ---------- merging ----------
await page.goto(`${base}#/discover?q=copilot`);
await page.waitForSelector('.paper');
check(seen.openalex.length === 1 && seen.crossref.length === 1, 'both sources are queried by default');
const cp = seen.crossref[0].searchParams;
check(cp.get('query') === 'copilot' && cp.get('rows') === '20', 'Crossref request built correctly');
check((await page.locator('.paper').count()) === 4, '4 unique papers (3 + 3 results, 2 shared DOIs merged)');
const summary = await page.textContent('#results-summary');
check(summary.includes('About 5,678 results') && summary.includes('OpenAlex and Crossref'), `summary names both sources and the larger total (${summary.slice(0, 60)}…)`);
const shared = page.locator('.paper', { hasText: 'Productivity Assessment' });
check((await shared.locator('.paper__sources').textContent()).includes('OpenAlex, Crossref'), 'merged paper lists both sources');
check((await shared.locator('.badge--oa').count()) === 1, 'open-access flag from OpenAlex survives the merge');
check((await shared.locator('.paper__abstract p').textContent()).length > 100, 'longer Crossref abstract chosen when it is more complete');
const crossrefOnly = page.locator('.paper', { hasText: 'Security Weaknesses' });
check((await crossrefOnly.locator('.paper__title').textContent()).includes('Copilot & Friends'), 'Crossref-only paper shown, entities decoded');
check((await crossrefOnly.locator('.paper__sources').textContent()).includes('Crossref') && !(await crossrefOnly.locator('.paper__sources').textContent()).includes('OpenAlex'), 'Crossref-only paper credited to Crossref only');
check((await crossrefOnly.locator('details p').textContent()) === 'We analyse 435 code snippets <generated> by AI assistants.', 'JATS abstract cleaned to readable text');
check((await page.locator('#results-body img, #results-body script').count()) === 0, 'no injected elements');

// source selection
await page.uncheck('#d-src-crossref');
await page.click('#search-form button[type=submit]');
await page.waitForFunction(() => location.hash.includes('src=openalex'));
await page.waitForFunction(() => document.querySelectorAll('.paper').length === 3);
check(seen.crossref.length === 1, 'unchecking Crossref stops it being queried');
check((await page.textContent('#results-summary')).includes('from OpenAlex.'), 'summary names only the chosen source');
await page.uncheck('#d-src-openalex');
await page.click('#search-form button[type=submit]');
check((await page.textContent('#d-src-openalex-error')).includes('at least one source'), 'no sources chosen is rejected');
check(await page.evaluate(() => document.activeElement.id === 'd-src-openalex'), 'focus goes to the first source checkbox');
await axe(page, 'sources validation error');
await page.check('#d-src-openalex');
await page.check('#d-src-crossref');

// partial failure
crossrefMode = 'down';
await page.fill('#d-q', 'partial');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('.notice');
check((await page.textContent('.notice')).includes('Crossref could not be searched'), 'partial failure explained in a notice');
check((await page.locator('.paper').count()) === 3, 'results from the working source are still shown');
await axe(page, 'results with a source notice');
crossrefMode = 'ok';

// open access skips Crossref
const before = seen.crossref.length;
await page.check('#d-oa');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('.notice');
check((await page.textContent('.notice')).includes('does not report open-access'), 'open-access filter says Crossref was skipped');
check(seen.crossref.length === before, 'Crossref not called when open access is required');
await page.uncheck('#d-oa');

// ---------- saving: no projects yet ----------
await page.fill('#d-q', 'copilot');
await page.click('#search-form button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.paper').length === 4);
check((await page.locator('.paper__actions a[href="#/projects"]').count()) === 4, 'with no projects, each paper offers "Create a project"');

// create two projects through the real UI
for (const name of ['AI-assisted coding', 'Security of generated code']) {
  await page.goto(`${base}#/projects`);
  await page.waitForSelector('#new-project');
  await page.fill('#new-name', name);
  await page.click('#new-project button[type=submit]');
  await page.waitForSelector('#add-rq');
}
await page.goto(`${base}#/discover?q=copilot`);
await page.waitForFunction(() => document.querySelectorAll('[data-save]').length === 4);
check(true, 'save buttons appear once projects exist');

// ---------- save flow ----------
const card = page.locator('.paper', { hasText: 'Productivity Assessment' });
const label = await card.locator('[data-save]').textContent();
check(label.includes('Save to project') && label.includes('Productivity Assessment'), 'save button has an accessible name that includes the paper');
await card.locator('[data-save]').click();
check(await page.locator('#save-dialog').evaluate((d) => d.open), 'Save opens the project dialog');
check((await page.locator('#save-paper').textContent()).includes('Productivity Assessment'), 'dialog shows which paper is being saved');
check((await page.locator('#save-project option').count()) === 2, 'both projects offered');
await axe(page, 'save dialog open');
await page.screenshot({ path: join(shots, 'save-dialog.png') });
await page.keyboard.press('Escape');
check(!(await page.locator('#save-dialog').evaluate((d) => d.open)), 'Esc cancels');
check((await card.locator('.paper__saved').count()) === 0, 'cancelling saves nothing');
check(await page.evaluate(() => document.activeElement.hasAttribute('data-save')), 'focus returns to the Save button after cancel');

await card.locator('[data-save]').click();
await page.selectOption('#save-project', { label: 'Security of generated code' });
await page.click('#save-dialog button[value=save]');
await page.waitForFunction(() => document.querySelector('.paper__saved'));
check((await card.locator('.paper__saved').textContent()) === 'Saved to: Security of generated code', 'card shows where it is saved (text, not colour)');
check((await page.locator('.toast', { hasText: 'Saved to' }).count()) >= 1, 'confirmation toast shown');
check(await page.evaluate(() => document.activeElement.hasAttribute('data-save')), 'focus stays on the card after saving');
check((await card.locator('[data-save]').textContent()).includes('Save to another project'), 'button now offers another project');
await card.locator('[data-save]').click();
check((await page.locator('#save-project option').count()) === 1, 'dialog only offers projects that do not already have it');
await page.selectOption('#save-project', { label: 'AI-assisted coding' });
await page.click('#save-dialog button[value=save]');
await page.waitForFunction(() => document.querySelector('.paper__saved').textContent.includes('AI-assisted coding'));
check((await card.locator('[data-save]').count()) === 0, 'no save button once saved to every project');
check((await card.locator('.paper__saved').textContent()).includes('Security of generated code') && (await card.locator('.paper__saved').textContent()).includes('AI-assisted coding'), 'card lists both projects');
await axe(page, 'results with saved paper');

// the remembered project is preselected next time
const other = page.locator('.paper', { hasText: 'Security Weaknesses' });
await other.locator('[data-save]').click();
check((await page.locator('#save-project option:checked').textContent()) === 'AI-assisted coding', 'last-used project is preselected');
await page.keyboard.press('Escape');

// ---------- persistence and the project page ----------
await page.reload();
await page.waitForFunction(() => document.querySelectorAll('.paper').length === 4);
check((await page.locator('.paper', { hasText: 'Productivity Assessment' }).locator('.paper__saved').count()) === 1, 'saved state survives a reload');
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=papers]').textContent !== '–');
check((await page.textContent('[data-stat=papers]')) === '1', 'dashboard counts 1 shared paper record');

await page.goto(`${base}#/projects`);
await page.waitForSelector('.project-card');
await page.click('.project-card a >> text=AI-assisted coding');
await page.waitForSelector('#sp-h');
check((await page.locator('.saved-paper').count()) === 1, 'project page lists the saved paper');
check((await page.textContent('#view-intro')).includes('1 saved paper'), 'project header counts saved papers');
await axe(page, 'project with saved papers');
await page.screenshot({ path: join(shots, 'project-saved-papers.png'), fullPage: true });
await page.click('[data-remove-paper]');
check(await page.evaluate(() => document.activeElement.textContent.trim() === 'Cancel'), 'remove asks first, focusing Cancel');
await page.click('#confirm-ok');
await page.waitForFunction(() => document.querySelectorAll('.saved-paper').length === 0);
check(await page.evaluate(() => document.activeElement.id === 'sp-h'), 'focus moves to the Saved papers heading after removal');
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=papers]').textContent !== '–');
check((await page.textContent('[data-stat=papers]')) === '1', 'paper kept because the other project still has it');

// deleting the last project that holds it prunes the paper
await page.goto(`${base}#/projects`);
await page.click('.project-card a >> text=Security of generated code');
await page.waitForSelector('#delete-project');
await page.click('#delete-project');
await page.click('#confirm-ok');
await page.waitForSelector('#new-project');
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=papers]').textContent !== '–');
check((await page.textContent('[data-stat=papers]')) === '0', 'orphaned paper removed when its last project is deleted');

check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- mobile ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2 })).newPage();
await m.route('https://api.openalex.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(openalex) }));
await m.route('https://api.crossref.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(crossref) }));
await m.goto(`${base}#/projects`);
await m.waitForSelector('#new-project');
await m.fill('#new-name', 'Mobile project');
await m.click('#new-project button[type=submit]');
await m.waitForSelector('#add-rq');
await m.goto(`${base}#/discover?q=copilot`);
await m.waitForSelector('[data-save]');
await m.locator('[data-save]').first().click();
check(await m.evaluate(() => { const d = document.querySelector('#save-dialog').getBoundingClientRect(); return d.left >= 0 && d.right <= window.innerWidth; }), 'mobile 320px: save dialog fits the screen');
await m.screenshot({ path: join(shots, 'save-dialog-mobile.png') });
await axe(m, 'mobile save dialog');
await m.keyboard.press('Escape');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: results with save controls do not scroll horizontally');

await finish();

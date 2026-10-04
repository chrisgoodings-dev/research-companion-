// Stage 10: Progress view, dashboard, not-found, storage blocked, print, forced colours, reduced motion.
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

// ---------- dashboard: finished-product wording ----------
await page.goto(`${base}#/dashboard`);
await page.waitForFunction(() => document.querySelector('[data-stat=projects]').textContent !== '–');
const dash = await page.textContent('main');
check(!/Stage \d|Build status|build plan/i.test(dash), 'dashboard carries no build-stage wording');
check((await page.locator('#glance-h').count()) === 1 && (await page.locator('main a[href="#/matrix"]').count()) >= 1, 'dashboard offers quick links');
await axe(page, 'dashboard');

// ---------- progress: empty ----------
await page.goto(`${base}#/progress`);
await page.waitForSelector('.empty-state');
check((await page.textContent('.empty-state')).includes('No projects yet'), 'progress with no projects explains what to do');
await axe(page, 'progress (no projects)');

// ---------- seed ----------
const ids = await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const A = await repo.projects.create({ name: 'AI-assisted coding' });
  const B = await repo.projects.create({ name: 'Empty project' });
  const q = [];
  for (const t of ['Does AI improve developer productivity?', 'What risks does AI-generated code carry?', 'How do developers perceive AI tools?']) q.push(await repo.questions.create(A.id, { text: t }));
  const mk = (id, title) => ({ id, title, authors: ['A'], year: 2022, sources: [] });
  for (const [id, t] of [['p1', 'Read with evidence'], ['p2', 'Read with evidence too'], ['p3', 'Read but nothing recorded'], ['p4', 'Currently reading'], ['p5', 'Not started']]) await repo.papers.saveToProject(A.id, mk(id, t));
  await repo.papers.saveReview(A.id, 'p1', { status: 'read', notes: 'n' });
  await repo.papers.saveReview(A.id, 'p2', { status: 'read' });
  await repo.papers.saveReview(A.id, 'p3', { status: 'read' });
  await repo.papers.saveReview(A.id, 'p4', { status: 'reading' });
  const add = (paperId, rq, relationship) => repo.evidence.create({ projectId: A.id, paperId, researchQuestionId: rq.id, relationship, evidence: 'e' });
  await add('p1', q[0], 'supports'); await add('p2', q[0], 'contradicts'); await add('p1', q[1], 'contextual');
  return { A: A.id, B: B.id, q1: q[0].id };
});

// ---------- progress ----------
await page.goto(`${base}#/progress?project=${ids.A}`);
await page.reload();
await page.waitForSelector('#read-bar');
const stats = await page.locator('.stat__value').allTextContents();
check(stats.join(',') === '5,3,1,3', `summary stats (status-only reviews are not counted as written reviews): ${stats.join(', ')}`);
const bar = page.locator('#read-bar');
check((await bar.getAttribute('value')) === '3' && (await bar.getAttribute('max')) === '5', 'reading progress uses a native <progress> with value and max');
check((await bar.getAttribute('aria-labelledby')) === 'read-bar-l' && (await page.textContent('#read-bar-l')).includes('3 of 5 papers read (60%)'), 'the bar is named, and the same fact is in text');
check((await page.textContent('#read-h + .meter + p, #read-h ~ .review__saved')).includes('Unread 1 · Reading 1 · Read 3'), 'status breakdown given as text');
const next = await page.textContent('#next-h + ul');
check(next.includes('1 saved paper has not been read yet'), 'next steps mention unread papers');
check(next.includes('1 paper marked as read has no evidence recorded: Read but nothing recorded'), 'next steps name the read-but-empty paper');
check(next.includes('RQ3 has no evidence yet') && next.includes('RQ2 rests on evidence from a single paper'), 'next steps flag empty and single-source questions');
check(next.includes('RQ1: the evidence conflicts (1 supporting, 1 contradicting)'), 'next steps flag the conflict in words');
check((await page.locator('#cov-h ~ ul > li').count()) === 3, 'one card per research question');
check((await page.locator(`#cov-${ids.q1}`).getAttribute('value')) === '2', 'RQ1 coverage: evidence from 2 papers');
check((await page.locator('#cov-h ~ ul > li').first().textContent()).includes('Supports 1, Contradicts 1') && (await page.locator('.matrix__conflict').count()) === 1, 'RQ1 card shows relationship counts and the conflict marker');
check((await page.locator('#read-h ~ h3').allTextContents()).join('|') === 'Not read yet|Read, but no evidence recorded', 'to-do lists present');
check((await page.locator('#read-h ~ ul a').first().getAttribute('href')).includes('tab=review'), 'to-do items link to the paper’s Review tab');
await axe(page, 'progress');
await page.screenshot({ path: join(shots, 'progress-desktop.png'), fullPage: true });

await page.selectOption('#progress-project', ids.B);
await page.waitForFunction(() => document.querySelector('#next-h + ul')?.textContent.includes('Save some papers'));
check(page.url().includes(`project=${ids.B}`) && (await page.textContent('#next-h + ul')).includes('Add at least one research question'), 'an empty project gets first-steps guidance and the URL updates');
await axe(page, 'progress (empty project)');

// ---------- not found ----------
await page.goto(`${base}#/no-such-page`);
await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Page not found');
check((await page.locator('main a').count()) >= 3 && !(await page.textContent('main')).includes('build plan'), 'not-found page offers ways back, without build-plan wording');
check((await page.textContent('main code')).includes('#/no-such-page'), 'and shows the address that was not found (escaped)');
await page.goto(`${base}#/x<img src=x onerror=window.__xss=1>`);
await page.waitForTimeout(150);
check(await page.evaluate(() => window.__xss === undefined) && (await page.locator('main img').count()) === 0, 'a hostile address is shown as text, not run');
await axe(page, 'not found');

// ---------- print ----------
await page.goto(`${base}#/matrix?project=${ids.A}`);
await page.reload();
await page.waitForSelector('table.matrix');
await page.emulateMedia({ media: 'print' });
const printed = await page.evaluate(() => ({
  nav: getComputedStyle(document.querySelector('.nav')).display,
  btn: [...document.querySelectorAll('.btn')].every((b) => getComputedStyle(b).display === 'none'),
  overflow: getComputedStyle(document.querySelector('.table-scroll')).overflowX,
  sticky: getComputedStyle(document.querySelector('tbody th')).position,
  bg: getComputedStyle(document.body).backgroundColor,
}));
check(printed.nav === 'none' && printed.btn, 'print: navigation and buttons are hidden');
check(printed.overflow === 'visible' && printed.sticky === 'static', 'print: the matrix is laid out in full, not in a scrolling region');
check(printed.bg === 'rgb(255, 255, 255)', 'print: white background');
await page.emulateMedia({ media: 'screen' });

// ---------- forced colours + reduced motion ----------
await page.goto(`${base}#/library`);
await page.emulateMedia({ forcedColors: 'active' });
await page.goto(`${base}#/matrix?project=${ids.A}`);
await page.reload();
await page.waitForSelector('table.matrix');
check(await page.evaluate(() => getComputedStyle(document.querySelector('.rel')).borderTopWidth) === '2px', 'forced colours: badges keep a visible border');
await page.screenshot({ path: join(shots, 'forced-colors-matrix.png') });
await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' });
check(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === 'auto', 'reduced motion: smooth scrolling is off');
await page.emulateMedia({ reducedMotion: 'no-preference' });

check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- storage blocked (private mode, policy): the app must degrade gracefully ----------
const works = JSON.parse(await readFile('tests/fixtures/openalex-works.json', 'utf8'));
const cr = JSON.parse(await readFile('tests/fixtures/crossref-empty.json', 'utf8'));
const blockedCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await blockedCtx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
const b = await blockedCtx.newPage();
const bErrors = [];
b.on('pageerror', (e) => bErrors.push(e.message));
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
await b.route('https://api.openalex.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(works) }));
await b.route('https://api.crossref.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(cr) }));
await b.goto(`${base}#/dashboard`);
await b.waitForSelector('[role=alert]');
check((await b.textContent('h1')) === 'Dashboard' && (await b.textContent('[role=alert]')).includes('could not load'), 'storage blocked: the dashboard keeps its heading and explains the problem');
check((await b.textContent('[role=alert]')).includes('IndexedDB is not available'), 'and says why');
await axe(b, 'dashboard with storage blocked');
await b.goto(`${base}#/projects`);
await b.waitForSelector('[role=alert]');
check((await b.textContent('h1')) === 'Projects', 'storage blocked: Projects explains instead of crashing');
await b.goto(`${base}#/discover?q=copilot`);
await b.waitForSelector('.paper');
check((await b.locator('.paper').count()) === 3, 'storage blocked: searching still works');
check((await b.textContent('#results-notes')).includes('Saving papers is unavailable'), 'and says saving is unavailable');
check((await b.locator('[data-save]').count()) === 0, 'and offers no save buttons');
await axe(b, 'discover with storage blocked');
check(bErrors.length === 0, `storage blocked: no uncaught errors${bErrors.length ? ': ' + bErrors.join('; ') : ''}`);

// ---------- mobile ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.goto(`${base}#/dashboard`);
await m.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js'); const repo = await getRepo();
  const P = await repo.projects.create({ name: 'A mobile project with a very long name to test wrapping' });
  const q = await repo.questions.create(P.id, { text: 'Does the progress view reflow at 320 pixels wide for long questions?' });
  await repo.papers.saveToProject(P.id, { id: 'm1', title: 'A_title_with_a_very_long_unbroken_segment_to_test_reflow_on_small_screens', authors: ['A'], sources: [] });
  await repo.papers.saveReview(P.id, 'm1', { status: 'read' });
  await repo.evidence.create({ projectId: P.id, paperId: 'm1', researchQuestionId: q.id, relationship: 'supports', evidence: 'x' });
});
await m.goto(`${base}#/progress`);
await m.reload();
await m.waitForSelector('#read-bar');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: progress view does not scroll sideways');
await m.screenshot({ path: join(shots, 'progress-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark progress');

await finish();

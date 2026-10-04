// Stage 8: Evidence matrix (table semantics, cells, summary/conflicts/gaps, drill-down, states, a11y).
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

// ---------- no projects ----------
await page.goto(`${base}#/matrix`);
await page.waitForSelector('.empty-state');
check((await page.textContent('.empty-state')).includes('No projects yet'), 'no projects: explains what to do');
await axe(page, 'matrix (no projects)');

// ---------- seed ----------
const ids = await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const A = await repo.projects.create({ name: 'AI-assisted coding' });
  const B = await repo.projects.create({ name: 'Needs questions' });
  const C = await repo.projects.create({ name: 'Needs papers' });
  const rq = [];
  for (const t of ['Does AI improve developer productivity?', 'What risks does AI-generated code carry?', 'How do developers perceive AI tools?']) rq.push(await repo.questions.create(A.id, { text: t }));
  await repo.questions.create(C.id, { text: 'A question without any papers yet?' });
  const mk = (id, title, year) => ({ id, title, authors: ['Ada Lovelace', 'Grace Hopper', 'Alan Turing'], year, sources: [] });
  await repo.papers.saveToProject(A.id, mk('p1', 'Productivity Assessment of Neural Code Completion', 2022));
  await repo.papers.saveToProject(A.id, mk('p2', 'Security Weaknesses of Copilot', 2023));
  await repo.papers.saveToProject(A.id, mk('p3', 'A Paper With No Evidence Yet', 2021));
  await repo.papers.saveToProject(B.id, mk('p1', 'Productivity Assessment of Neural Code Completion', 2022));
  const add = (paperId, q, relationship, evidence) => repo.evidence.create({ projectId: A.id, paperId, researchQuestionId: q.id, relationship, evidence });
  await add('p1', rq[0], 'supports', 'Faster by 55%.');
  await add('p1', rq[0], 'supports', 'Acceptance rate predicts productivity.');
  await add('p1', rq[0], 'contradicts', 'No gain for experts.');
  await add('p2', rq[0], 'supports', 'Fewer keystrokes.');
  await add('p2', rq[1], 'contextual', 'Background on vulnerabilities.');
  return { A: A.id, B: B.id, C: C.id, rq1: rq[0].id, rq2: rq[1].id };
});

// ---------- the matrix ----------
await page.goto(`${base}#/matrix?project=${ids.A}`);
await page.reload();
await page.waitForSelector('table.matrix');
check((await page.textContent('table.matrix caption')).includes('AI-assisted coding'), 'table has a caption naming the project');
check((await page.locator('thead th[scope=col]').count()) === 4, 'column headers use scope=col (Paper + 3 questions)');
check((await page.locator('tbody th[scope=row]').count()) === 3 && (await page.locator('tfoot th[scope=row]').count()) === 1, 'each row has a row header');
check((await page.locator('tbody tr').first().locator('td').count()) === 3, 'one cell per research question in each row');
check((await page.textContent('thead th >> nth=1')).startsWith('RQ1') && (await page.textContent('thead th >> nth=1')).includes('Does AI improve developer productivity?'), 'column header gives RQ1 and (for screen readers) the full question');
const rowOf = (t) => page.locator('tbody tr', { hasText: t });
check((await page.locator('tbody th').allTextContents()).map((t) => t.trim().slice(0, 12)).join('|') === 'A Paper With|Productivity|Security Wea', 'rows are sorted alphabetically by title');
check((await rowOf('Productivity Assessment').locator('th').textContent()).includes('Ada Lovelace, Grace Hopper et al. · 2022'), 'row header shows title, authors and year');

const c11 = rowOf('Productivity Assessment').locator('td').nth(0);
const c11Text = await c11.textContent();
check(c11Text.includes('Supports') && c11Text.includes('(2)') && c11Text.includes('Contradicts'), 'cell shows each relationship with its count as text');
check(c11Text.includes('for RQ1, Productivity Assessment of Neural Code Completion: Supports 2, Contradicts 1. View evidence.'), 'cell has a full accessible description');
const empty = rowOf('A Paper With No Evidence').locator('td').nth(0);
check((await empty.textContent()).includes('No evidence recorded'), 'empty cell is announced as "No evidence recorded"');
check((await empty.locator('[aria-hidden=true]').textContent()) === '—', 'the dash is decorative');
check((await page.locator('tfoot td >> nth=0').textContent()).includes('2 of 3 papers') && (await page.locator('tfoot td >> nth=0').textContent()).includes('Evidence conflicts'), 'summary flags that RQ1 evidence conflicts');
check((await page.locator('tfoot td >> nth=2').textContent()).includes('No evidence recorded'), 'summary shows RQ3 has no evidence');

// what stands out
const notes = await page.textContent('#notes-h + ul');
check(notes.includes('RQ1: evidence conflicts (Supports 3, Contradicts 1)'), 'notes call out the conflict in words');
check(notes.includes('No evidence yet for: RQ3') && notes.includes('A Paper With No Evidence Yet'), 'notes list gaps (questions and papers)');
check((await page.textContent('.key')).includes('No evidence recorded for this paper and question'), 'key explains the dash');
check((await page.locator('.key__questions dt').count()) === 3, 'key lists every research question in full');
check((await page.textContent('.results__summary')).includes('3 papers × 3 research questions · 5 evidence records'), 'size summary');

await axe(page, 'matrix');
await page.screenshot({ path: join(shots, 'matrix-desktop.png'), fullPage: true });

// ---------- keyboard ----------
await page.focus('.nav__link[href="#/matrix"]');
for (let i = 0; i < 40; i += 1) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement.matches('.table-scroll'))) break; }
check(await page.evaluate(() => document.activeElement.matches('.table-scroll')), 'the scrollable table region is reachable by keyboard');
check((await page.getByRole('region', { name: /Evidence matrix for/ }).count()) === 1 && (await page.getAttribute('.table-scroll', 'aria-labelledby')) === 'matrix-cap', 'the scroll area is a named region (a <section> labelled by the caption)');
await page.keyboard.press('Tab');
check(await page.evaluate(() => document.activeElement.closest('th')?.scope === 'row' || document.activeElement.matches('tbody th a')), 'Tab then reaches the first paper link');

// ---------- drill-down ----------
await page.click('tbody tr:has-text("Productivity Assessment") td >> nth=0 >> a');
await page.waitForSelector('.ev');
check(page.url().includes(`project=${ids.A}`) && page.url().includes(`rq=${ids.rq1}`) && page.url().includes('paper=p1'), 'cell links to the Evidence page filtered by project, question and paper');
check((await page.locator('.ev').count()) === 3 && (await page.locator('#ef-paper').inputValue()) === 'p1', 'exactly that cell’s three records are shown and the Paper filter reflects it');
await page.goBack();
await page.waitForSelector('table.matrix');
await page.click('tfoot td >> nth=0 >> a');
await page.waitForSelector('.ev');
check((await page.locator('.ev').count()) === 4, 'summary cell links to all evidence for that question');
await page.goBack();
await page.waitForSelector('table.matrix');
await page.click('tbody tr:has-text("Productivity Assessment") th a');
await page.waitForSelector('#ev-add');
check(await page.locator('#panel-evidence').isVisible(), 'row header opens the paper’s Evidence tab');

// ---------- project switching and empty states ----------
await page.goto(`${base}#/matrix`);
await page.waitForSelector('#matrix-project');
check((await page.locator('#matrix-project option').count()) === 3, 'project select lists every project');
await page.selectOption('#matrix-project', ids.B);
await page.waitForSelector('.empty-state');
check((await page.textContent('.empty-state')).includes('needs research questions') && page.url().includes(`project=${ids.B}`), 'project without questions: explains, URL updated');
await page.waitForFunction(() => document.querySelector('#announcer').textContent === 'Evidence matrix for Needs questions');
check(true, 'choosing another project is announced to screen readers');
await axe(page, 'matrix (needs questions)');
await page.selectOption('#matrix-project', ids.C);
await page.waitForFunction(() => document.querySelector('.empty-state h2')?.textContent.includes('saved papers'));
check((await page.locator('.empty-state a[href="#/discover"]').count()) === 1, 'project without papers links to Discover');
await page.selectOption('#matrix-project', ids.A);
await page.waitForSelector('table.matrix');
await page.reload();
await page.waitForSelector('table.matrix');
check((await page.locator('#matrix-project').inputValue()) === ids.A, 'reload keeps the chosen project');

// matrix reflects new evidence
await page.evaluate(async ({ A, rq2 }) => {
  const { getRepo } = await import('/js/db/index.js'); const repo = await getRepo();
  await repo.evidence.create({ projectId: A, paperId: 'p3', researchQuestionId: rq2, relationship: 'none', evidence: 'Looked, found nothing.' });
}, ids);
await page.reload();
await page.waitForSelector('table.matrix');
check((await rowOf('A Paper With No Evidence').locator('td').nth(1).textContent()).includes('No evidence'), 'a new "No evidence" record appears in the matrix');
check(!(await page.textContent('#notes-h + ul')).includes('A Paper With No Evidence Yet'), 'and the paper leaves the gaps list');

check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- mobile (320px) and dark ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.goto(`${base}#/dashboard`);
await m.evaluate(async (src) => {
  // reuse the same data: copy into this context's own database via the app's repository
  const { getRepo } = await import('/js/db/index.js'); const repo = await getRepo();
  const P = await repo.projects.create({ name: 'Mobile matrix project' });
  const qs = [];
  for (const t of ['First question that is long enough?', 'Second question that is long enough?', 'Third question that is long enough?', 'Fourth question that is long enough?']) qs.push(await repo.questions.create(P.id, { text: t }));
  for (const [id, title] of [['m1', 'A_title_with_a_very_long_unbroken_segment_to_test_reflow_on_small_screens'], ['m2', 'Second paper']]) await repo.papers.saveToProject(P.id, { id, title, authors: ['A'], year: 2020, sources: [] });
  await repo.evidence.create({ projectId: P.id, paperId: 'm1', researchQuestionId: qs[0].id, relationship: 'supports', evidence: 'x' });
  await repo.evidence.create({ projectId: P.id, paperId: 'm1', researchQuestionId: qs[0].id, relationship: 'contradicts', evidence: 'y' });
  await repo.evidence.create({ projectId: P.id, paperId: 'm2', researchQuestionId: qs[3].id, relationship: 'mixed', evidence: 'z' });
}, null);
await m.goto(`${base}#/matrix`);
await m.reload();
await m.waitForSelector('table.matrix');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: the page does not scroll sideways (only the table does)');
check(await m.evaluate(() => { const r = document.querySelector('.table-scroll'); return r.scrollWidth > r.clientWidth; }), 'mobile 320px: the wide table scrolls inside its own region');
await m.screenshot({ path: join(shots, 'matrix-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark matrix');

await finish();

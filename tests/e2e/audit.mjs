// Stage 11: whole-app audit. Every page x light/dark x three viewports.
//  - axe-core: WCAG 2.0/2.1/2.2 A+AA *and* best-practice rules
//  - keyboard-only pass: every control reachable by Tab, focus always visible, no traps
//  - WCAG 1.4.12 text-spacing stress test: nothing clipped, no sideways scrolling
//  - basic document checks: one <h1>, unique ids, landmarks
// Writes docs/testing/accessibility-audit.md. Run: node tests/e2e/audit.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { start } from './helpers.mjs';
import { createRequire } from 'node:module';

const { base, browser, check, finish } = await start();
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const works = JSON.parse(await readFile('tests/fixtures/openalex-works.json', 'utf8'));
const crossref = JSON.parse(await readFile('tests/fixtures/crossref-works.json', 'utf8'));
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

const VIEWPORTS = [{ name: 'desktop 1280', width: 1280, height: 900 }, { name: 'tablet 768', width: 768, height: 1024 }, { name: 'phone 320', width: 320, height: 700 }];
const THEMES = ['light', 'dark'];

async function newPage(viewport, theme) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme });
  await ctx.route('https://api.openalex.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(works) }));
  await ctx.route('https://api.crossref.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(crossref) }));
  return { ctx, page: await ctx.newPage() };
}

/** Seed one rich data set through the app's own repository. Returns ids used to build URLs. */
async function seed(page) {
  await page.goto(`${base}#/dashboard`);
  return page.evaluate(async () => {
    const { getRepo } = await import('/js/db/index.js');
    const repo = await getRepo();
    const A = await repo.projects.create({ name: 'AI-assisted coding', description: 'Does AI help developers write better software?' });
    const B = await repo.projects.create({ name: 'Security of generated code' });
    const q = [];
    for (const t of ['Does AI code generation improve developer productivity?', 'What risks does AI-generated code introduce?', 'How do developers perceive AI tools?']) q.push(await repo.questions.create(A.id, { text: t }));
    const mk = (id, title, extra = {}) => ({ id, title, authors: ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Edsger Dijkstra', 'Barbara Liskov'], year: 2022, venue: 'Journal of Software Evidence', doi: '10.1000/x', abstract: 'A readable abstract about developer productivity.', url: 'https://example.org/p', sources: ['openalex', 'crossref'], citedBy: 12, isOa: true, oaStatus: 'green', ...extra });
    await repo.papers.saveToProject(A.id, mk('p1', 'Productivity Assessment of Neural Code Completion'));
    await repo.papers.saveToProject(A.id, mk('p2', 'Security Weaknesses of Copilot Generated Code', { doi: '', isOa: false, oaStatus: 'closed' }));
    await repo.papers.saveToProject(A.id, mk('p3', 'A Paper Nobody Has Read Yet', { abstract: '' }));
    await repo.papers.saveToProject(B.id, mk('p1', 'Productivity Assessment of Neural Code Completion'));
    await repo.papers.saveReview(A.id, 'p1', { status: 'read', studyAim: 'Aim', methodology: 'Method', keyFindings: 'Findings' });
    await repo.papers.saveReview(A.id, 'p2', { status: 'reading' });
    const add = (paperId, rq, relationship, extra = {}) => repo.evidence.create({ projectId: A.id, paperId, researchQuestionId: rq.id, relationship, evidence: 'Reported finding.', ...extra });
    await add('p1', q[0], 'supports', { interpretation: 'My reading.', location: 'Table 2', tags: 'speed, productivity' });
    await add('p2', q[0], 'contradicts');
    await add('p1', q[1], 'mixed');
    await add('p2', q[1], 'contextual');
    await add('p2', q[2], 'none');
    return { A: A.id, B: B.id };
  });
}

const pagesFor = (id) => [
  ['Dashboard', '#/dashboard'], ['Projects', '#/projects'], ['Project detail', `#/projects/${id.A}`],
  ['Discover (idle)', '#/discover'], ['Discover (results)', '#/discover?q=copilot'],
  ['Library', '#/library'], ['Paper: overview', '#/library/p1?project=' + id.A], ['Paper: review', `#/library/p1?tab=review&project=${id.A}`], ['Paper: evidence', `#/library/p1?tab=evidence&project=${id.A}`],
  ['Evidence', '#/evidence'], ['Evidence (no matches)', '#/evidence?q=zzzzzz'],
  ['Matrix', `#/matrix?project=${id.A}`], ['Progress', `#/progress?project=${id.A}`], ['Backup & export', '#/backup'], ['Not found', '#/nothing-here'],
];

async function waitSettled(page, name) {
  await page.waitForFunction(() => !document.querySelector('#view-body[aria-busy="true"]') && !document.querySelector('#results[aria-busy="true"]'));
  if (name.includes('results')) await page.waitForSelector('.paper');
  await page.waitForTimeout(120);
}

async function axeRun(page) {
  await page.evaluate(axeSource);
  return page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
}

/** Keyboard-only: Tab through the page; every visible control must be reached and show a focus indicator. */
async function keyboardPass(page) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  // Tag every control that should be reachable with a unique id, so identical-looking buttons are told apart.
  const expected = await page.evaluate(() => {
    const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden], dialog:not([open]), details:not([open]) > :not(summary)');
    const sel = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]';
    let n = 0;
    const out = [];
    // A radio group has ONE Tab stop (the checked radio, else the first); arrow keys move within it.
    const radioStop = new Map();
    for (const el of document.querySelectorAll('input[type=radio]')) if (visible(el) && (!radioStop.has(el.name) || el.checked)) radioStop.set(el.name, el);
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      if (el.getAttribute('tabindex') === '-1') continue;           // roving tabindex (ARIA tabs): arrow keys, not Tab
      if (el.type === 'radio' && radioStop.get(el.name) !== el) continue;
      el.setAttribute('data-kb', String((n += 1)));
      out.push({ id: n, label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 40)}"` });
    }
    return out;
  });
  const reached = new Set();
  const noIndicator = [];
  const obscured = [];
  const trapped = false; // a real trap shows up as controls that were never reached
  for (let i = 0; i < expected.length + 15; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor !== 'rgba(0, 0, 0, 0)';
      // WCAG 2.4.11 Focus Not Obscured: a fixed bar (the phone bottom nav) must not cover the focused control
      const rect = el.getBoundingClientRect();
      let covered = '';
      for (const bar of document.querySelectorAll('.nav, .topbar, .toasts')) {
        if (bar.contains(el) || getComputedStyle(bar).position !== 'fixed') continue;
        const b = bar.getBoundingClientRect();
        if (b.height < 1) continue;   // an empty container (the toast area with no toast showing) hides nothing
        if (!(rect.bottom > b.top + 1 && rect.top < b.bottom - 1 && rect.right > b.left && rect.left < b.right)) continue;
        // A control taller than half the screen (a focusable panel or scroll area) legitimately runs under the bar;
        // what matters is that its top edge, where the focus ring starts, is clear of it.
        const tall = rect.height > window.innerHeight / 2;
        if (!tall || rect.top > b.top - 24) covered = ` [element ${Math.round(rect.top)}-${Math.round(rect.bottom)}, bar from ${Math.round(b.top)}, scrollY ${Math.round(window.scrollY)}/${Math.round(document.documentElement.scrollHeight - window.innerHeight)}]`;
      }
      return { id: Number(el.getAttribute('data-kb')) || null, covered, ok: outline || cs.boxShadow !== 'none', label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent || '').trim().slice(0, 30)}"` };
    });
    if (!info) break; // focus left the document: reached the end
    if (info.id && reached.has(info.id)) break; // wrapped round to the start: the whole document has been traversed
    if (info.id) reached.add(info.id);
    if (!info.ok) noIndicator.push(info.label);
    if (info.covered) obscured.push(info.label + info.covered);
  }
  const unreached = expected.filter((e) => !reached.has(e.id)).map((e) => e.label);
  return { expected: expected.length, reached: reached.size, trapped, unreached, noIndicator: [...new Set(noIndicator)], obscured: [...new Set(obscured)] };
}

const TEXT_SPACING = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
async function textSpacing(page) {
  const handle = await page.addStyleTag({ content: TEXT_SPACING });
  const result = await page.evaluate(() => {
    const clipped = [];
    for (const el of document.querySelectorAll('main *, .nav *, .topbar *')) {
      if (el.classList.contains('visually-hidden') || el.closest('.visually-hidden') || el.closest('.table-scroll') || el.tagName === 'PROGRESS') continue;
      const cs = getComputedStyle(el);
      if (['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY)) {
        if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) clipped.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
    }
    return { sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, clipped: [...new Set(clipped)] };
  });
  await handle.evaluate((el) => el.remove());
  return result;
}

const docChecks = (page) => page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  return { h1: document.querySelectorAll('h1').length, dupIds: [...new Set(dup)], main: document.querySelectorAll('main').length, lang: document.documentElement.lang, title: document.title };
});

const report = [];
const failures = [];
let seeded;

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await newPage(vp, theme);
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    seeded = await seed(page);
    for (const [name, hash] of pagesFor(seeded)) {
      await page.goto(`${base}${hash}`);
      await page.reload(); // same-origin hash changes do not re-render on goto, so reload for a clean mount
      await waitSettled(page, name);
      const label = `${name} · ${vp.name} · ${theme}`;
      const axeResult = await axeRun(page);
      const doc = await docChecks(page);
      const spacing = await textSpacing(page);
      const kb = theme === 'light' ? await keyboardPass(page) : null;
      const row = { name, vp: vp.name, theme, violations: axeResult.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 3) })), doc, spacing, kb };
      report.push(row);
      if (row.violations.length) failures.push(`${label}: axe ${row.violations.map((v) => `${v.id} [${v.nodes[0]}]`).join('; ')}`);
      if (doc.h1 !== 1 || doc.dupIds.length || doc.main !== 1 || doc.lang !== 'en' || !doc.title) failures.push(`${label}: document ${JSON.stringify(doc)}`);
      if (spacing.sideways || spacing.clipped.length) failures.push(`${label}: text spacing ${JSON.stringify(spacing)}`);
      if (kb && (kb.trapped || kb.unreached.length || kb.noIndicator.length || kb.obscured.length)) failures.push(`${label}: keyboard ${JSON.stringify({ trapped: kb.trapped, unreached: kb.unreached, noIndicator: kb.noIndicator, obscured: kb.obscured })}`);
    }
    if (pageErrors.length) failures.push(`${vp.name}/${theme}: uncaught errors ${pageErrors.join('; ')}`);
    await ctx.close();
  }
}

// ---------- write the report ----------
const total = report.length;
const axeClean = report.filter((r) => r.violations.length === 0).length;
const kbRows = report.filter((r) => r.kb);
const md = [
  '# Accessibility and quality audit',
  '',
  `Generated by \`node tests/e2e/audit.mjs\` on ${new Date().toISOString().slice(0, 10)}. Re-run it after any change; it fails if anything regresses.`,
  '',
  '## Coverage',
  `- **${new Set(report.map((r) => r.name)).size} pages/states** × **${VIEWPORTS.length} viewports** (${VIEWPORTS.map((v) => v.name).join(', ')}) × **${THEMES.length} themes** = **${total} page audits**, each with rich seeded data (projects, questions, saved papers, reviews, evidence of every relationship).`,
  '- **axe-core 4.x** with the WCAG 2.0, 2.1 and 2.2 level A and AA rule sets **plus best-practice rules**.',
  '- **Keyboard-only pass** (light theme, every viewport): Tab through the page; every visible link, button and field must be reached, focus must show a visible indicator (outline of at least 2px or shadow), focus must never get stuck, and (WCAG 2.2 · 2.4.11) the focused control must not be hidden behind a fixed bar such as the phone bottom navigation.',
  '- **WCAG 1.4.12 text-spacing stress test**: line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em; nothing may be clipped and the page must not scroll sideways.',
  '- **Document checks**: exactly one `<h1>` and one `<main>`, no duplicate ids, `lang="en"`, non-empty `<title>`.',
  '',
  '## Result',
  `- axe-core: **${axeClean} of ${total}** audits with **0 violations** (WCAG 2.2 AA and best practice).`,
  `- Keyboard: **${kbRows.filter((r) => !r.kb.trapped && r.kb.reached >= r.kb.expected && !r.kb.noIndicator.length).length} of ${kbRows.length}** passes reached every control with a visible focus indicator and no traps.`,
  `- Text spacing: **${report.filter((r) => !r.spacing.sideways && !r.spacing.clipped.length).length} of ${total}** audits with nothing clipped and no sideways scrolling.`,
  `- Failures: **${failures.length}**.`,
  '',
  '## Per page (violations across the 6 viewport/theme combinations; keyboard = controls reached / controls expected, desktop light)',
  '',
  '| Page | axe violations | Keyboard (desktop) | Keyboard (tablet) | Keyboard (phone) |',
  '|---|---|---|---|---|',
  ...[...new Set(report.map((r) => r.name))].map((name) => {
    const rows = report.filter((r) => r.name === name);
    const kb = (vp) => { const r = rows.find((x) => x.vp === vp && x.kb); return r ? `${r.kb.reached}/${r.kb.expected}` : '-'; };
    return `| ${name} | ${rows.reduce((n, r) => n + r.violations.length, 0)} | ${kb('desktop 1280')} | ${kb('tablet 768')} | ${kb('phone 320')} |`;
  }),
  '',
  failures.length ? `## Failures\n\n${failures.map((f) => `- ${f}`).join('\n')}\n` : '',
].join('\n');
await writeFile('docs/testing/accessibility-audit.md', md);

check(failures.length === 0, `audit: ${total} page audits, ${failures.length} failure(s)${failures.length ? '\n   - ' + failures.slice(0, 25).join('\n   - ') : ''}`);
await finish();

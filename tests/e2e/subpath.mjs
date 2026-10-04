// Deployability: the site must work when hosted under a sub-path (GitHub Pages project sites live at
// https://<user>.github.io/<repo>/). Any absolute "/js/..." or "/css/..." URL would 404 there.
import { start } from './helpers.mjs';

const { base, browser, check, axe, finish } = await start({ prefix: '/research-companion-' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });
page.on('requestfailed', (r) => bad.push(`failed ${r.url()}`));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(base);
await page.waitForSelector('[data-stat=projects]');
check(base.endsWith('/research-companion-/'), `serving under the sub-path ${new URL(base).pathname}`);
check((await page.textContent('h1')) === 'Dashboard' && (await page.locator('link[rel=stylesheet]:not([media=print])').count()) >= 4, 'dashboard renders with its styles');
check(await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'stylesheets actually applied');
for (const r of ['projects', 'discover', 'library', 'evidence', 'matrix', 'progress', 'backup']) {
  await page.click(`.nav__link[href="#/${r}"], .nav__footer[href="#/${r}"]`);
  await page.waitForFunction((name) => document.title.toLowerCase().startsWith(name), r === 'backup' ? 'backup' : r);
}
check(true, 'every page loads its lazily imported code from the sub-path');
await page.click('.nav__link[href="#/projects"]');
await page.waitForSelector('#new-project');
await page.fill('#new-name', 'Sub-path project');
await page.click('#new-project button[type=submit]');
await page.waitForSelector('#add-rq');
check((await page.textContent('h1')) === 'Sub-path project', 'saving to IndexedDB works from the sub-path');
await axe(page, 'sub-path project page');
check(bad.length === 0, `no failed or 4xx requests${bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''}`);
check(errors.length === 0, `no uncaught errors${errors.length ? ': ' + errors.join('; ') : ''}`);
await finish();

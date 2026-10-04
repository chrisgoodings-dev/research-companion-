// End-to-end smoke test: serves the site, drives it in Chromium, runs axe-core, saves screenshots.
// Run: npm run test:e2e   (set CHROMIUM_PATH if your Chromium is elsewhere)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const root = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const name = path === '/' ? '/index.html' : path;
    const file = await readFile(join(root, name));
    res.writeHead(200, { 'content-type': types[extname(name)] ?? 'application/octet-stream' }).end(file);
  } catch { res.writeHead(404).end('not found'); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const shots = join(root, 'docs/testing/screenshots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

async function axe(page, label) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  check(result.violations.length === 0, `axe (${label}): ${result.violations.length} violation(s)${result.violations.map((v) => `\n      - ${v.id}: ${v.help} [${v.nodes.map((n) => n.target).join(' | ')}]`).join('')}`);
}

const routes = ['dashboard', 'projects', 'discover', 'library', 'evidence', 'matrix', 'progress'];

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(base);
  await page.waitForSelector('h1');
  check((await page.title()).startsWith('Dashboard'), `[${theme}] title set for dashboard`);
  await page.screenshot({ path: join(shots, `dashboard-desktop-${theme}.png`), fullPage: true });
  await axe(page, `desktop ${theme} dashboard`);

  if (theme === 'light') {
    for (const r of routes) {
      await page.click(`.nav__link[href="#/${r}"]`);
      await page.waitForFunction((name) => document.querySelector(`.nav__link[href="#/${name}"]`)?.getAttribute('aria-current') === 'page', r);
      const h1 = await page.textContent('h1');
      check(Boolean(h1), `[desktop] route #/${r} renders h1 "${h1}"`);
      check(await page.evaluate(() => document.activeElement === document.querySelector('h1')), `[desktop] focus moves to h1 on #/${r}`);
      check((await page.getAttribute(`.nav__link[href="#/${r}"]`, 'aria-current')) === 'page', `[desktop] aria-current on ${r}`);
    }
    await page.goto(`${base}#/nope`);
    check((await page.textContent('h1')) === 'Page not found', 'unknown route shows not-found page');
    await axe(page, 'desktop light not-found');

    // Keyboard: first Tab reveals the skip link; activating it focuses <main>.
    await page.goto(base);
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')), 'first Tab lands on skip link');
    await page.keyboard.press('Enter');
    check(await page.evaluate(() => document.activeElement?.id === 'main'), 'skip link moves focus to main');

    // Theme toggle persists
    await page.click('#theme-toggle');
    check((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme toggle switches to dark');
    await page.reload();
    check((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme choice persists after reload');
  }
  check(errors.length === 0, `[${theme}] no console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await ctx.close();
}

// Mobile (320px = WCAG 1.4.10 reflow width)
const mctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, hasTouch: true });
const m = await mctx.newPage();
await m.goto(base);
await m.waitForSelector('h1');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: no horizontal scroll');
check((await m.locator('.nav__secondary').first().isVisible()) === false, 'mobile: secondary nav items hidden');
check((await m.locator('.nav__list >> text=Menu').isVisible()), 'mobile: Menu button visible');
const navBox = await m.locator('.nav').boundingBox();
check(navBox && Math.abs(navBox.y + navBox.height - 640) < 2, 'mobile: nav pinned to bottom');
await m.screenshot({ path: join(shots, 'dashboard-mobile.png'), fullPage: true });
await axe(m, 'mobile dashboard');

await m.click('#menu-btn');
check(await m.locator('#more-menu').evaluate((d) => d.open), 'mobile: Menu opens dialog');
await m.screenshot({ path: join(shots, 'menu-mobile.png') });
await axe(m, 'mobile menu open');
await m.keyboard.press('Escape');
check(await m.locator('#more-menu').evaluate((d) => !d.open), 'mobile: Esc closes menu');
check(await m.evaluate(() => document.activeElement?.id === 'menu-btn'), 'mobile: focus returns to Menu button');
await m.click('#menu-btn');
await m.click('.sheet__link[href="#/matrix"]');
await m.waitForFunction(() => document.title.startsWith('Matrix'));
check((await m.textContent('h1')) === 'Evidence matrix', 'mobile: menu link navigates and closes');
check(await m.locator('#more-menu').evaluate((d) => !d.open), 'mobile: menu closed after navigation');

// 200% text zoom equivalent: 640px-wide viewport at 2x font size should not clip content
const zctx = await browser.newContext({ viewport: { width: 640, height: 800 } });
const z = await zctx.newPage();
await z.goto(base);
await z.addStyleTag({ content: 'html{font-size:200%}' });
check(await z.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), '200% font size at 640px: no horizontal scroll');

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

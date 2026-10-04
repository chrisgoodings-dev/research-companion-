// Smoke test: navigation, theme, keyboard, responsive layout, axe, screenshots.   Run: npm run test:e2e
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();

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
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Page not found'); // routes load their code on demand, so wait for the page
check(true, 'unknown route shows not-found page');
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
await z.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); // CSSOM change: allowed under the page's CSP, unlike injecting a <style> tag
check(await z.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), '200% font size at 640px: no horizontal scroll');

await finish();

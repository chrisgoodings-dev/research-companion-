// Stage 4: Discover (search form, filters, results, states). OpenAlex is mocked with fixtures;
// the live API is blocked in some environments and tests must never depend on third-party uptime.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const works = JSON.parse(await readFile('tests/fixtures/openalex-works.json', 'utf8'));
const empty = JSON.parse(await readFile('tests/fixtures/openalex-empty.json', 'utf8'));
const CORS = { 'access-control-allow-origin': '*' };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('429') && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

const requests = [];
let mode = 'ok';
await page.route('https://api.openalex.org/**', async (route) => {
  requests.push(new URL(route.request().url()));
  if (mode === 'slow') await new Promise((r) => setTimeout(r, 700));
  if (mode === 'offline') return route.abort('failed');
  if (mode === 'rate') return route.fulfill({ status: 429, headers: CORS, body: '{}' });
  if (mode === 'empty') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(empty) });
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(works) });
});

await page.goto(`${base}#/discover`);
await page.waitForSelector('#search-form');
check((await page.textContent('#results-summary')).includes('Enter a search'), 'idle state explains what to do');
check(requests.length === 0, 'no API request before the user searches');
check((await page.getAttribute('#search-form', 'role')) === 'search', 'form exposes the search landmark');
await axe(page, 'discover (idle)');

// --- Validation
await page.click('#search-form button[type=submit]');
check(await page.evaluate(() => document.activeElement.id === 'd-q'), 'empty search focuses the query field');
check((await page.textContent('#d-q-error')).includes('Enter search for papers'), 'empty search explains the problem');
await page.fill('#d-q', 'a');
await page.click('#search-form button[type=submit]');
check((await page.textContent('#d-q-error')).includes('at least 2'), 'one-character search rejected');
await page.fill('#d-q', 'ai code generation');
await page.fill('#d-from', '2024');
await page.fill('#d-to', '2020');
await page.click('#search-form button[type=submit]');
check((await page.textContent('#d-to-error')).includes('same as, or later'), 'from-year after to-year rejected (cross-field rule)');
check(requests.length === 0, 'invalid searches never reach the API');
await page.fill('#d-from', '1800');
await page.fill('#d-to', '');
await page.click('#search-form button[type=submit]');
check((await page.textContent('#d-from-error')).includes('1900 or later'), 'out-of-range year rejected with a specific message');
await axe(page, 'discover (validation errors)');

// --- Successful search with filters
await page.fill('#d-from', '2020');
await page.fill('#d-to', '2024');
await page.check('#d-oa');
await page.selectOption('#d-sort', 'cited');
mode = 'slow';
await page.click('#search-form button[type=submit]');
await page.waitForFunction(() => document.querySelector('#results').getAttribute('aria-busy') === 'true');
check((await page.textContent('#results-summary')).includes('Searching'), 'loading state shown while waiting');
await axe(page, 'discover (loading)');
await page.waitForSelector('.paper');
check((await page.locator('#results').getAttribute('aria-busy')) === 'false', 'aria-busy cleared after results arrive');
const q = requests.at(-1).searchParams;
check(q.get('search') === 'ai code generation', 'API called with the search text');
check(q.get('filter') === 'publication_year:2020-2024,is_oa:true', `filters sent to API (${q.get('filter')})`);
check(q.get('sort') === 'cited_by_count:desc', 'sort sent to API');
check(page.url().includes('#/discover?q=ai+code+generation&from=2020&to=2024&oa=1&sort=cited'), 'search state is stored in the URL');
check((await page.textContent('#results-summary')).includes('1,234 results'), 'summary shows the formatted total');
check((await page.locator('.paper').count()) === 3, 'three usable papers rendered (titleless record dropped)');
check((await page.textContent('.paper__title')).startsWith('Productivity Assessment'), 'first title rendered');
check((await page.textContent('.paper__authors')) === 'Albert Ziegler, Eirini Kalliamvakou, Shawn Simister, Ganesh Sittampalam et al.', 'authors truncated with et al.');
check((await page.locator('.badge--oa').first().textContent()).includes('Open access (green)'), 'open-access status shown as text');

// abstract disclosure
check((await page.locator('details').first().evaluate((d) => d.open)) === false, 'abstract collapsed by default');
await page.focus('.paper__abstract summary');
await page.keyboard.press('Enter');
check((await page.locator('details').first().evaluate((d) => d.open)) === true, 'abstract opens with the keyboard');
check((await page.textContent('.paper__abstract p')).startsWith('Neural code completion tools'), 'abstract reconstructed from inverted index');

// security: untrusted API data
const html = await page.innerHTML('#results-body');
check(!html.includes('<script') && !html.includes('javascript:'), 'no script tags or javascript: URLs in rendered output');
check((await page.locator('.paper__title a').count()) === 2, 'paper with an unsafe URL renders its title without a link');
check((await page.locator('.paper__title a >> nth=0').getAttribute('rel')) === 'noopener noreferrer', 'external links use rel=noopener noreferrer');
check((await page.locator('.paper__title a >> nth=0').textContent()).includes('opens in a new tab'), 'external links warn about opening a new tab');
check((await page.locator('#results-body img').count()) === 0, 'author names are HTML-escaped: no <img> element was injected');
await page.waitForTimeout(100);
check(await page.evaluate(() => window.__xss === undefined), 'injected event-handler markup never executes');
check((await page.textContent('.paper >> nth=1 >> .paper__authors')).includes('<img src=x'), 'hostile author name is displayed as literal text');
check((await page.textContent('.paper >> nth=2')).includes('A alert(1)Survey'), 'markup in titles is shown as plain text');
await axe(page, 'discover (results)');
await page.screenshot({ path: join(shots, 'discover-results-desktop.png'), fullPage: true });

// --- Pagination, Back button
await page.click('[data-page="2"]');
await page.waitForFunction(() => location.hash.includes('page=2'));
check(requests.at(-1).searchParams.get('page') === '2', 'Next requests page 2');
await page.waitForSelector('.paper');
check(await page.evaluate(() => document.activeElement.id === 'results-h'), 'focus moves to the results heading after paging');
await page.goBack();
await page.waitForFunction(() => !location.hash.includes('page=2'));
await page.waitForSelector('.paper');
check(await page.locator('#d-sort').inputValue() === 'cited' && await page.isChecked('#d-oa'), 'Back restores form values from the URL');

// --- Direct link / reload re-runs the search
const before = requests.length;
await page.reload();
await page.waitForSelector('.paper');
check(requests.length === before + 1 && (await page.locator('#d-q').inputValue()) === 'ai code generation', 'reload restores the search from the URL');

// --- Empty results
mode = 'empty';
await page.fill('#d-q', 'zzzzqqqq');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('.empty-state');
check((await page.textContent('#results-summary')).includes('No papers found'), 'empty result state explained');
await axe(page, 'discover (no results)');

// --- Rate limited, then retry works
mode = 'rate';
await page.fill('#d-q', 'retry me');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('#results-body [role=alert]');
check((await page.textContent('#results-body [role=alert]')).includes('too many requests'), 'rate-limit message is specific');
mode = 'ok';
await page.click('#retry');
await page.waitForSelector('.paper');
check(true, 'Try again recovers after an error');

// --- Offline
mode = 'offline';
await page.fill('#d-q', 'no network');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('#results-body [role=alert]');
check((await page.textContent('#results-body [role=alert]')).includes('internet connection'), 'network failure message is specific');
await axe(page, 'discover (error)');

// --- Latest search wins (stale response ignored)
mode = 'ok';
await page.fill('#d-q', 'first query');
await page.click('#search-form button[type=submit]');
await page.fill('#d-q', 'second query');
await page.click('#search-form button[type=submit]');
await page.waitForSelector('.paper');
check((await page.textContent('#results-summary')).includes('second query'), 'only the latest search is shown');

check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// --- Mobile + dark
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.route('https://api.openalex.org/**', (r) => r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(works) }));
await m.goto(`${base}#/discover?q=copilot`);
await m.waitForSelector('.paper');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: no horizontal scroll with results');
await m.screenshot({ path: join(shots, 'discover-results-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark discover results');

await finish();

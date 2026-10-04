// Stage 6: Library (filters), paper detail (ARIA tabs), structured review form.
import { join } from 'node:path';
import { start } from './helpers.mjs';

const { base, browser, check, axe, shots, finish } = await start();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

// ---------- empty library ----------
await page.goto(`${base}#/library`);
await page.waitForSelector('.empty-state');
check((await page.textContent('.empty-state')).includes('Your library is empty'), 'empty library explains what to do');
check((await page.locator('.empty-state a[href="#/discover"]').count()) === 1, 'empty library links to Discover');
await axe(page, 'library (empty)');

// ---------- seed through the app's own repository ----------
const ids = await page.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const a = await repo.projects.create({ name: 'AI-assisted coding' });
  const b = await repo.projects.create({ name: 'Security of generated code' });
  const mk = (id, title, extra) => ({ id, title, authors: ['Ada Lovelace', 'Grace Hopper'], year: 2021, venue: 'Journal of Tests', doi: '', abstract: 'An abstract.', url: 'https://example.org/p', sources: ['openalex'], citedBy: 1, ...extra });
  const papers = [
    mk('doi:10.1145/3597503.3608128', 'Productivity Assessment of Neural Code Completion', { doi: '10.1145/3597503.3608128', year: 2022, citedBy: 214, isOa: true, oaStatus: 'green', oaUrl: 'https://arxiv.org/pdf/2205.06537', sources: ['openalex', 'crossref'], abstract: 'Neural code completion tools can improve developer productivity.' }),
    mk('openalex:W2', 'Is GitHub Copilot a Substitute for Human Pair-programming?', { year: 2023, citedBy: 87, abstract: '' }),
    mk('doi:10.1109/tse.2023.9999999', 'Security Weaknesses of Copilot & Friends', { doi: '10.1109/tse.2023.9999999', year: 2023, citedBy: 41 }),
    mk('openalex:W4', 'A <b>Survey</b> of Large Language Models for Code', { year: null, citedBy: 3 }),
  ];
  await repo.papers.saveToProject(a.id, papers[0]);
  await new Promise((r) => setTimeout(r, 5));
  await repo.papers.saveToProject(a.id, papers[1]);
  await new Promise((r) => setTimeout(r, 5));
  await repo.papers.saveToProject(b.id, papers[0]);
  await repo.papers.saveToProject(b.id, papers[2]);
  await new Promise((r) => setTimeout(r, 5));
  await repo.papers.saveToProject(b.id, papers[3]);
  await repo.papers.saveReview(a.id, papers[1].id, { status: 'read', keyFindings: 'Pair programming still wins.' });
  return { a: a.id, b: b.id };
});

// ---------- library list ----------
await page.reload(); // same hash: goto would not re-render
await page.waitForSelector('.lib-item');
check((await page.locator('.lib-item').count()) === 4, 'four saved papers listed');
check((await page.textContent('#lib-count')).includes('4 papers shown.'), 'count announced in a status region');
check((await page.locator('.lib-item .paper__title').first().textContent()).includes('Survey'), 'most recently saved first');
check((await page.textContent('.lib-item >> nth=0')).includes('<b>Survey</b>') || (await page.textContent('.lib-item >> nth=0')).includes('A <b>Survey</b>'), 'markup in a stored title is shown as text');
const multi = page.locator('.lib-item', { hasText: 'Productivity Assessment' });
check((await multi.locator('.chip').count()) === 2, 'paper saved in two projects shows two chips');
check((await page.locator('.lib-item', { hasText: 'Pair-programming' }).textContent()).includes('Read · Reviewed'), 'status and review shown as text');
await axe(page, 'library list');
await page.screenshot({ path: join(shots, 'library-desktop.png'), fullPage: true });

// keyword filter
await page.fill('#lib-q', 'copilot');
check((await page.locator('.lib-item').count()) === 2, 'keyword filter narrows results');
await page.waitForFunction(() => document.querySelector('#lib-count').textContent.includes('2 papers shown of 4'));
check(page.url().includes('q=copilot'), 'filter state is kept in the URL');
await page.fill('#lib-q', 'zzzz');
check((await page.textContent('#lib-clear').catch(() => '')) === 'Clear filters', 'no matches shows a clear-filters button');
await axe(page, 'library (no matches)');
await page.click('#lib-clear');
check((await page.locator('.lib-item').count()) === 4, 'Clear filters restores everything');
check(await page.evaluate(() => document.activeElement.id === 'lib-q'), 'focus returns to the keyword box after clearing');

// project / status / sort
await page.selectOption('#lib-project', { label: 'AI-assisted coding' });
check((await page.locator('.lib-item').count()) === 2, 'project filter');
check((await multi.locator('.chip').count()) === 1, 'with a project filter only that project chip is shown');
await page.selectOption('#lib-status', 'read');
check((await page.locator('.lib-item').count()) === 1, 'status filter (read in this project)');
await page.selectOption('#lib-project', 'all');
await page.selectOption('#lib-status', 'any');
await page.selectOption('#lib-sort', 'cited');
check((await page.locator('.lib-item .paper__title').first().textContent()).startsWith('Productivity'), 'sort by most cited');
await page.selectOption('#lib-sort', 'title');
check((await page.locator('.lib-item .paper__title').first().textContent()).startsWith('A '), 'sort by title');

// state survives reload
await page.reload();
await page.waitForSelector('.lib-item');
check((await page.locator('#lib-sort').inputValue()) === 'title', 'reload restores sort from the URL');

// ---------- paper detail ----------
await page.goto(`${base}#/library`);
await page.waitForSelector('.lib-item');
await page.click('.lib-item a >> text=Productivity Assessment');
await page.waitForSelector('[role=tablist]');
check((await page.textContent('h1')).startsWith('Productivity Assessment'), 'detail page heading is the paper title');
check(page.url().includes('doi%3A10.1145%2F3597503.3608128'), 'ids containing "/" and ":" are encoded in the URL');
check((await page.title()).startsWith('Productivity Assessment'), 'document title reflects the paper');

// ARIA tabs
check((await page.getAttribute('#tab-overview', 'aria-selected')) === 'true' && (await page.getAttribute('#tab-review', 'aria-selected')) === 'false', 'Overview is selected first');
check((await page.getAttribute('#tab-review', 'tabindex')) === '-1', 'unselected tab is out of the Tab order (roving tabindex)');
check((await page.getAttribute('#panel-overview', 'aria-labelledby')) === 'tab-overview', 'panel is labelled by its tab');
check(await page.locator('#panel-review').isHidden(), 'inactive panel is hidden');
const overview = await page.textContent('#panel-overview');
check(overview.includes('Albert') === false && overview.includes('Ada Lovelace, Grace Hopper'), 'overview lists all authors');
check(overview.includes('Neural code completion tools can improve') && overview.includes('Open access (green)') && overview.includes('OpenAlex, Crossref'), 'overview shows abstract, access and sources');
check((await page.locator('#panel-overview a[href="https://doi.org/10.1145/3597503.3608128"]').count()) === 1, 'DOI is a link');
check((await page.locator('#panel-overview .chip').count()) === 2, 'overview lists both projects');
await axe(page, 'paper detail: overview');

await page.focus('#tab-overview');
await page.keyboard.press('ArrowRight');
check((await page.getAttribute('#tab-review', 'aria-selected')) === 'true' && await page.evaluate(() => document.activeElement.id === 'tab-review'), 'ArrowRight selects and focuses the next tab');
check(await page.locator('#panel-overview').isHidden() && await page.locator('#panel-review').isVisible(), 'panels switch');
check(page.url().includes('tab=review'), 'tab is kept in the URL');
await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement.id === 'tab-overview'), 'ArrowRight wraps around');
await page.keyboard.press('End');
check(await page.evaluate(() => document.activeElement.id === 'tab-review'), 'End goes to the last tab');
await page.keyboard.press('Home');
check(await page.evaluate(() => document.activeElement.id === 'tab-overview'), 'Home goes to the first tab');
await page.click('#tab-review');

// ---------- review form (paper is in two projects) ----------
check((await page.locator('#rv-project option').count()) === 2, 'project picker appears when a paper is in several projects');
await axe(page, 'paper detail: review');
await page.screenshot({ path: join(shots, 'paper-review-desktop.png'), fullPage: true });
check((await page.locator('input[name=rv-status]:checked').getAttribute('value')) === 'unread', 'new review defaults to Unread');
const project1 = await page.locator('#rv-project').inputValue();
await page.check('#rv-status-reading');
await page.fill('#rv-studyAim', 'Measure how completion acceptance relates to productivity.');
await page.fill('#rv-keyFindings', 'Acceptance rate is the best predictor.');
check((await page.textContent('[data-counter-for=rv-studyAim]')).trim().startsWith('55 / 2000') || (await page.textContent('[data-counter-for=rv-studyAim]')).includes('/ 2000'), 'character counter shown');
await page.click('#review-form button[type=submit]');
await page.waitForFunction(() => document.querySelector('#review-saved').textContent.startsWith('Last saved'));
check((await page.locator('.toast', { hasText: 'Review saved' }).count()) >= 1, 'saving shows a confirmation');

// switch project with unsaved changes -> guarded
await page.fill('#rv-notes', 'unsaved note');
await page.selectOption('#rv-project', { index: project1 === (await page.locator('#rv-project option >> nth=0').getAttribute('value')) ? 1 : 0 });
check(await page.locator('#confirm-dialog').evaluate((d) => d.open), 'switching project with unsaved changes asks first');
check(await page.evaluate(() => document.activeElement.textContent.trim() === 'Cancel'), 'Cancel is focused, not Discard');
await page.click('#confirm-dialog button[value=cancel]');
await page.waitForFunction((p) => document.querySelector('#rv-project').value === p, project1);
check((await page.locator('#rv-project').inputValue()) === project1, 'cancelling keeps the current project selected');
check((await page.locator('#rv-notes').inputValue()) === 'unsaved note', 'unsaved text is kept');
await page.selectOption('#rv-project', { index: project1 === (await page.locator('#rv-project option >> nth=0').getAttribute('value')) ? 1 : 0 });
await page.click('#confirm-ok');
await page.waitForFunction(() => document.querySelector('#rv-studyAim').value === ''); // form re-rendered for the other project
check((await page.locator('#rv-studyAim').inputValue()) === '', 'the other project has its own, empty review');
check((await page.locator('input[name=rv-status]:checked').getAttribute('value')) === 'unread', 'and its own status');
check(page.url().includes('tab=review') && page.url().includes('project='), 'URL records tab and project');
check(await page.evaluate(() => document.activeElement.id === 'rv-project'), 'focus stays on the project picker after switching');

// persistence
await page.reload();
await page.waitForSelector('#review-form');
check(await page.locator('#panel-review').isVisible(), 'reload keeps the Review tab selected');
await page.selectOption('#rv-project', project1);
check((await page.locator('#rv-studyAim').inputValue()).startsWith('Measure how completion'), 'saved review is restored');
check((await page.locator('input[name=rv-status]:checked').getAttribute('value')) === 'reading', 'saved status is restored');
check((await page.locator('#rv-notes').inputValue()) === '', 'discarded text was not saved');

// a single-project paper shows no picker
await page.goto(`${base}#/library`);
await page.waitForSelector('.lib-item');
await page.click('.lib-item a >> text=Pair-programming');
await page.waitForSelector('[role=tablist]');
await page.click('#tab-review');
check((await page.locator('#rv-project').count()) === 0 && (await page.textContent('.review__project')).includes('AI-assisted coding'), 'single-project paper shows the project name, not a picker');
check((await page.locator('input[name=rv-status]:checked').getAttribute('value')) === 'read', 'seeded review status shown');
check((await page.locator('#rv-keyFindings').inputValue()) === 'Pair programming still wins.', 'seeded review text shown');
await page.click('#tab-overview');
check((await page.textContent('#panel-overview')).includes('No abstract is available'), 'missing abstract is explained');

// project page links to the review, and shows status
await page.goto(`${base}#/projects/${ids.a}`);
await page.waitForSelector('.saved-paper');
check((await page.textContent('.saved-paper >> nth=0')).match(/Read · Reviewed|Reading/) !== null, 'project page shows status of saved papers');
await page.click('.saved-paper a:has-text("Review") >> nth=0');
await page.waitForSelector('[role=tablist]');
check(await page.locator('#panel-review').isVisible(), 'Review link on the project page opens the Review tab');

// not found
await page.goto(`${base}#/library/doi%3A10.1%2Fnope`);
await page.waitForFunction(() => document.querySelector('h1').textContent === 'Paper not found');
check(true, 'unknown paper shows a not-found message');
check(errors.length === 0, `no unexpected console/page errors${errors.length ? ': ' + errors.join('; ') : ''}`);

// ---------- mobile + dark ----------
const m = await (await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
await m.goto(`${base}#/dashboard`);
await m.evaluate(async () => {
  const { getRepo } = await import('/js/db/index.js');
  const repo = await getRepo();
  const p = await repo.projects.create({ name: 'A project with a rather long name to test wrapping' });
  await repo.papers.saveToProject(p.id, { id: 'doi:10.1000/averyveryverylongidentifierwithoutanybreaks1234567890', title: 'Supercalifragilisticexpialidocious_title_without_any_spaces_whatsoever_to_test_reflow', authors: ['A'], year: 2020, doi: '10.1000/averyveryverylongidentifierwithoutanybreaks1234567890', url: 'https://example.org' });
});
await m.goto(`${base}#/library`);
await m.waitForSelector('.lib-item');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: library does not scroll horizontally');
await m.screenshot({ path: join(shots, 'library-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark library');
await m.click('.lib-item a');
await m.waitForSelector('[role=tablist]');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: paper overview does not scroll horizontally');
await axe(m, 'mobile dark overview');
await m.click('#tab-review');
check(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'mobile 320px: review form does not scroll horizontally');
await m.screenshot({ path: join(shots, 'paper-review-mobile-dark.png'), fullPage: true });
await axe(m, 'mobile dark review');

await finish();

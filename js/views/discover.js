import { SORTS } from '../api/openalex.js';
import { searchAll, SOURCES, ALL_SOURCES } from '../api/search.js';
import { formatAuthors } from '../api/paper.js';
import { getRepo } from '../db/index.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { field } from '../ui/fields.js';
import { wireForm } from '../ui/forms.js';
import { announce } from '../ui/announcer.js';
import { showToast } from '../ui/toast.js';
import { chooseProject } from '../ui/saveDialog.js';

const THIS_YEAR = new Date().getFullYear();
const num = new Intl.NumberFormat('en-GB');
const OA_LABEL = { gold: 'Open access (gold)', green: 'Open access (green)', hybrid: 'Open access (hybrid)', bronze: 'Open access (bronze)', diamond: 'Open access (diamond)' };
const SORT_LABEL = { relevance: 'Relevance', newest: 'Newest first', cited: 'Most cited' };

/** The whole search is described by the URL (#/discover?q=…&from=…), so results are shareable and
 *  the browser's Back button restores them. */
function readQuery() {
  const p = parseQuery(location.hash);
  const src = (p.get('src') ?? '').split(',').filter((s) => ALL_SOURCES.includes(s));
  return {
    q: (p.get('q') ?? '').trim(),
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    oa: p.get('oa') === '1',
    sort: Object.hasOwn(SORTS, p.get('sort')) ? p.get('sort') : 'relevance',
    page: Math.max(1, Number.parseInt(p.get('page'), 10) || 1),
    sources: src.length ? src : ALL_SOURCES,
  };
}

function toHash({ q, from, to, oa, sort, page, sources }) {
  const p = new URLSearchParams({ q });
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (oa) p.set('oa', '1');
  if (sort && sort !== 'relevance') p.set('sort', sort);
  if (sources.length !== ALL_SOURCES.length) p.set('src', sources.join(','));
  if (page > 1) p.set('page', String(page));
  return `#/discover?${p}`;
}

const yearOrder = (form) => {
  const from = form.querySelector('#d-from');
  const to = form.querySelector('#d-to');
  return from.value && to.value && Number(from.value) > Number(to.value)
    ? [{ input: to, message: 'Latest year must be the same as, or later than, the earliest year.' }] : [];
};
const sourceChosen = (form) => (form.querySelector('input[name="d-src"]:checked')
  ? [] : [{ input: form.querySelector('#d-src-openalex'), message: 'Choose at least one source.' }]);

export const discoverRoute = {
  title: 'Discover',
  render() {
    const q = readQuery();
    return `
    <div class="page-header">
      <h1>Discover</h1>
      <p>Search scholarly papers through OpenAlex and Crossref, then save the useful ones to a project.</p>
    </div>

    <form id="search-form" class="card form" role="search" aria-label="Search papers">
      ${field({ id: 'd-q', label: 'Search for papers', hint: 'Keywords or a phrase, for example "AI code generation productivity".', type: 'search', value: q.q, required: true, minlength: 2, maxlength: 200, enterkeyhint: 'search' })}

      <fieldset class="filters">
        <legend>Filters</legend>
        <div class="filters__grid">
          ${field({ id: 'd-from', label: 'Earliest year', hint: 'A four-digit year, e.g. 2020.', type: 'number', value: q.from, min: 1900, max: THIS_YEAR + 1, step: 1, inputmode: 'numeric' })}
          ${field({ id: 'd-to', label: 'Latest year', hint: 'A four-digit year, e.g. 2024.', type: 'number', value: q.to, min: 1900, max: THIS_YEAR + 1, step: 1, inputmode: 'numeric' })}
          <div class="field">
            <label class="field__label" for="d-sort">Sort by</label>
            <p class="field__hint" id="d-sort-hint">How results are ordered.</p>
            <select id="d-sort" name="d-sort" aria-describedby="d-sort-hint">
              ${Object.keys(SORTS).map((k) => `<option value="${k}"${k === q.sort ? ' selected' : ''}>${SORT_LABEL[k]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="check">
          <input type="checkbox" id="d-oa" name="d-oa" value="1" aria-describedby="d-oa-hint"${q.oa ? ' checked' : ''}>
          <label for="d-oa">Open access only</label>
          <p class="field__hint check__hint" id="d-oa-hint">Only papers that can be read for free. Crossref does not report this, so it is skipped when this is on.</p>
        </div>
      </fieldset>

      <fieldset class="filters">
        <legend>Sources</legend>
        <p class="field__hint" id="d-src-openalex-hint">Choose at least one. Results from both are merged and duplicates (same DOI) are combined.</p>
        ${ALL_SOURCES.map((key) => `
        <div class="check">
          <input type="checkbox" id="d-src-${key}" name="d-src" value="${key}"${q.sources.includes(key) ? ' checked' : ''}${key === ALL_SOURCES[0] ? ' aria-describedby="d-src-openalex-hint d-src-openalex-error"' : ''}>
          <label for="d-src-${key}">${SOURCES[key].label}</label>
        </div>`).join('')}
        <p class="field__error" id="d-src-openalex-error" hidden></p>
      </fieldset>

      <p class="form-status" role="alert"></p>
      <button type="submit" class="btn btn--primary">Search</button>
    </form>

    <section id="results" class="results" aria-labelledby="results-h" aria-busy="false">
      <h2 id="results-h" tabindex="-1">Results</h2>
      <p id="results-summary" class="results__summary">Enter a search above to find papers.</p>
      <div id="results-notes"></div>
      <div id="results-body"></div>
    </section>`;
  },

  async mount(outlet) {
    const form = outlet.querySelector('#search-form');
    const section = outlet.querySelector('#results');
    const summary = outlet.querySelector('#results-summary');
    const notes = outlet.querySelector('#results-notes');
    const body = outlet.querySelector('#results-body');
    let controller;
    let papersById = new Map();

    // Saving needs browser storage. If it is blocked, searching must still work.
    let repo = null;
    let projects = [];
    let saved = {};
    try { repo = await getRepo(); await refreshSaved(); } catch { repo = null; }

    async function refreshSaved() {
      [projects, saved] = await Promise.all([repo.projects.list(), repo.papers.savedMap()]);
    }
    const nameOf = (id) => projects.find((p) => p.id === id)?.name ?? 'a deleted project';

    async function run(query, { moveFocus = false } = {}) {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;

      section.setAttribute('aria-busy', 'true');
      summary.textContent = `Searching for “${query.q}”…`;
      notes.innerHTML = '';
      body.innerHTML = '';
      announce(`Searching for ${query.q}`);

      try {
        const result = await searchAll(query, { sources: query.sources, signal });
        if (signal.aborted) return;
        if (repo) await refreshSaved().catch(() => {});
        draw(query, result);
        if (moveFocus) outlet.querySelector('#results-h').focus();
      } catch (err) {
        if (err.kind === 'aborted' || signal.aborted) return;
        drawError(query, err);
      } finally {
        if (!signal.aborted) section.setAttribute('aria-busy', 'false');
      }
    }

    function draw(query, { total, page, pages, papers, notes: sourceNotes, sourcesUsed }) {
      papersById = new Map(papers.map((p) => [p.id, p]));
      notes.innerHTML = [
        ...sourceNotes.map((n) => `<p class="notice" role="note">${esc(n.message)}</p>`),
        repo ? '' : '<p class="notice" role="note">Saving papers is unavailable because your browser is blocking local storage.</p>',
      ].join('');

      if (!papers.length) {
        summary.textContent = `No papers found for “${query.q}”.`;
        body.innerHTML = `<div class="card empty-state"><h3>No results</h3>
          <p>Try fewer or more general keywords, check the spelling, or widen the year range${query.oa ? ' and turn off “Open access only”' : ''}.</p></div>`;
        announce(`No results found for ${query.q}`);
        return;
      }
      const from = sourcesUsed.map((s) => SOURCES[s].label).join(' and ');
      const message = `${sourcesUsed.length > 1 ? 'About ' : ''}${num.format(total)} result${total === 1 ? '' : 's'} for “${query.q}” from ${from}. Page ${page} of ${num.format(pages)}.`;
      summary.textContent = message;
      announce(`${message.replace(/[“”]/g, '')}${sourceNotes.length ? ` ${sourceNotes.length} source notice${sourceNotes.length === 1 ? '' : 's'} below.` : ''}`);

      body.innerHTML = `<ol class="stack results__list" start="${(page - 1) * 20 + 1}">${papers.map((p) => `<li class="card paper" data-paper="${esc(p.id)}">${paperCard(p)}${savePanel(p)}</li>`).join('')}</ol>${pager(page, pages)}`;
      body.querySelectorAll('[data-page]').forEach((btn) => btn.addEventListener('click', () => go({ ...query, page: Number(btn.dataset.page) }, true)));
      body.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', () => save(btn.dataset.save)));
    }

    function savePanel(p) {
      if (!repo) return '';
      if (!projects.length) {
        return '<div class="paper__actions"><a class="btn btn--secondary btn--small" href="#/projects">Create a project to save papers</a></div>';
      }
      const inProjects = saved[p.id] ?? [];
      const remaining = projects.filter((pr) => !inProjects.includes(pr.id));
      const status = inProjects.length ? `<p class="paper__saved">Saved to: ${inProjects.map((id) => esc(nameOf(id))).join(', ')}</p>` : '';
      const button = remaining.length
        ? `<button type="button" class="btn btn--secondary btn--small" data-save="${esc(p.id)}">${inProjects.length ? 'Save to another project' : 'Save to project'}<span class="visually-hidden">: ${esc(p.title)}</span></button>`
        : '';
      return `<div class="paper__actions">${button}${status}</div>`;
    }

    async function save(paperId) {
      const paper = papersById.get(paperId);
      const card = body.querySelector(`[data-paper="${CSS.escape(paperId)}"]`);
      const inProjects = saved[paperId] ?? [];
      const choices = projects.filter((pr) => !inProjects.includes(pr.id));
      const projectId = await chooseProject({ paperTitle: paper.title, projects: choices });
      if (!projectId) return; // cancelled: focus is already back on the button
      try {
        await repo.papers.saveToProject(projectId, paper);
        await refreshSaved();
        const slot = card.querySelector('.paper__actions');
        slot.outerHTML = savePanel(paper);
        card.querySelector('[data-save]')?.addEventListener('click', () => save(paperId));
        (card.querySelector('[data-save]') ?? card.querySelector('.paper__saved'))?.setAttribute('tabindex', '-1');
        (card.querySelector('[data-save]') ?? card.querySelector('.paper__saved'))?.focus();
        showToast(`Saved to “${nameOf(projectId)}”`);
      } catch (err) {
        console.error(err);
        showToast(`Could not save: ${err.message}`);
      }
    }

    function drawError(query, err) {
      summary.textContent = 'The search could not be completed.';
      body.innerHTML = `<div class="card" role="alert"><h3>Search failed</h3><p>${esc(err.userMessage ?? err.message)}</p>
        <button type="button" class="btn btn--primary" id="retry">Try again</button></div>`;
      body.querySelector('#retry').addEventListener('click', () => run(query));
    }

    /** Update the URL (so Back works) without re-rendering the form, then search. */
    function go(query, moveFocus = false) {
      history.pushState(null, '', toHash(query));
      run(query, { moveFocus });
    }

    wireForm(form, async (v, data) => {
      go({ q: v['d-q'].trim(), from: v['d-from'], to: v['d-to'], oa: v['d-oa'] === '1', sort: v['d-sort'], sources: data.getAll('d-src'), page: 1 });
    }, { crossChecks: [yearOrder, sourceChosen] });

    const initial = readQuery();
    if (initial.q.length >= 2) await run(initial);
  },
};

function paperCard(p) {
  const oa = p.isOa ? `<span class="badge badge--oa">${esc(OA_LABEL[p.oaStatus] ?? 'Open access')}</span>` : '';
  const title = p.url
    ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}<span class="visually-hidden"> (opens in a new tab)</span></a>`
    : esc(p.title);
  const meta = [p.year, p.venue].filter(Boolean).map(esc).join(' · ');
  return `
      <h3 class="paper__title">${title}</h3>
      <p class="paper__authors">${esc(formatAuthors(p.authors))}</p>
      <p class="paper__meta">${meta || 'Year and venue unknown'} ${oa} <span class="badge">Cited by ${num.format(p.citedBy)}</span></p>
      ${p.abstract
        ? `<details class="paper__abstract"><summary>Abstract</summary><p>${esc(p.abstract)}</p></details>`
        : '<p class="paper__noabstract">No abstract available.</p>'}
      ${p.doi ? `<p class="paper__doi">DOI: <a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer">${esc(p.doi)}<span class="visually-hidden"> (opens in a new tab)</span></a></p>` : ''}
      <p class="paper__sources">Found in: ${p.sources.map((s) => esc(SOURCES[s]?.label ?? s)).join(', ')}</p>`;
}

function pager(page, pages) {
  if (pages <= 1) return '';
  return `<nav class="pager" aria-label="Search result pages">
    <button type="button" class="btn btn--secondary" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>Previous<span class="visually-hidden"> page</span></button>
    <span class="pager__status">Page ${page} of ${num.format(pages)}</span>
    <button type="button" class="btn btn--secondary" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Next<span class="visually-hidden"> page</span></button>
  </nav>`;
}

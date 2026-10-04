import { getRepo } from '../db/index.js';
import { filterPapers, LIB_SORTS, LIB_STATUSES } from '../library.js';
import { REVIEW_MAX } from '../validation.js';
import { formatAuthors } from '../api/paper.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { field } from '../ui/fields.js';
import { wireForm } from '../ui/forms.js';
import { announce } from '../ui/announcer.js';
import { showToast } from '../ui/toast.js';
import { confirmAction } from '../ui/confirm.js';
import { initTabs } from '../ui/tabs.js';
import { formatDate, plural, STATUS_LABEL } from '../ui/format.js';

const OA_LABEL = { gold: 'Open access (gold)', green: 'Open access (green)', hybrid: 'Open access (hybrid)', bronze: 'Open access (bronze)', diamond: 'Open access (diamond)' };
const SOURCE_LABEL = { openalex: 'OpenAlex', crossref: 'Crossref' };
const paperHref = (id, { tab, project } = {}) => {
  const p = new URLSearchParams();
  if (tab && tab !== 'overview') p.set('tab', tab);
  if (project) p.set('project', project);
  const qs = p.toString();
  return `#/library/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`;
};

export const libraryRoute = {
  title: 'Library',
  render: (params) => `
    <div class="page-header"><h1>${params[0] ? 'Paper' : 'Library'}</h1><p id="view-intro"></p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,
  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    if (params[0]) await mountDetail(outlet, repo, params[0], ctx);
    else await mountList(outlet, repo);
  },
};

/* =============================== Library list =============================== */
async function mountList(outlet, repo) {
  const body = outlet.querySelector('#view-body');
  const intro = outlet.querySelector('#view-intro');
  const [items, projects] = await Promise.all([repo.papers.listAll(), repo.projects.list()]);
  const nameOf = (id) => projects.find((p) => p.id === id)?.name ?? 'Deleted project';
  body.removeAttribute('aria-busy');
  intro.textContent = 'Every paper you have saved, across all projects.';

  if (!items.length) {
    body.innerHTML = `<div class="card empty-state"><h2>Your library is empty</h2>
      <p>Search for papers in Discover and save the useful ones to a project. They will appear here.</p>
      <a class="btn btn--primary" href="#/discover">Find papers</a></div>`;
    return;
  }

  const q = parseQuery(location.hash);
  const state = {
    q: q.get('q') ?? '',
    project: projects.some((p) => p.id === q.get('project')) ? q.get('project') : 'all',
    status: Object.hasOwn(LIB_STATUSES, q.get('status')) ? q.get('status') : 'any',
    sort: Object.hasOwn(LIB_SORTS, q.get('sort')) ? q.get('sort') : 'saved',
  };
  const options = (map, selected) => Object.entries(map).map(([v, label]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');

  body.innerHTML = `
    <form id="lib-filters" class="card form" role="search" aria-label="Filter saved papers">
      ${field({ id: 'lib-q', label: 'Filter by keyword', hint: 'Matches title, authors, venue, year or DOI.', type: 'search', value: state.q, maxlength: 200, optionalTag: false })}
      <div class="filters__grid">
        <div class="field"><label class="field__label" for="lib-project">Project</label>
          <select id="lib-project" name="lib-project">${`<option value="all">All projects</option>${projects.map((p) => `<option value="${esc(p.id)}"${p.id === state.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}`}</select></div>
        <div class="field"><label class="field__label" for="lib-status">Reading status</label>
          <select id="lib-status" name="lib-status">${options(LIB_STATUSES, state.status)}</select></div>
        <div class="field"><label class="field__label" for="lib-sort">Sort by</label>
          <select id="lib-sort" name="lib-sort">${options(LIB_SORTS, state.sort)}</select></div>
      </div>
    </form>
    <p id="lib-count" class="results__summary" role="status"></p>
    <div id="lib-results"></div>`;

  const form = body.querySelector('#lib-filters');
  const count = body.querySelector('#lib-count');
  const results = body.querySelector('#lib-results');
  let timer;

  function draw() {
    const shown = filterPapers(items, state);
    const message = `${plural(shown.length, 'paper')} shown${shown.length === items.length ? '' : ` of ${items.length}`}.`;
    clearTimeout(timer);
    timer = setTimeout(() => { count.textContent = message; }, 350); // debounced so typing is not announced per keystroke
    if (!count.textContent) count.textContent = message;

    if (!shown.length) {
      results.innerHTML = `<div class="card empty-state"><h2>No saved papers match</h2><p>Try different keywords or clear the filters.</p>
        <button type="button" class="btn btn--secondary" id="lib-clear">Clear filters</button></div>`;
      results.querySelector('#lib-clear').addEventListener('click', () => {
        Object.assign(state, { q: '', project: 'all', status: 'any', sort: 'saved' });
        form.querySelector('#lib-q').value = ''; form.querySelector('#lib-project').value = 'all';
        form.querySelector('#lib-status').value = 'any'; form.querySelector('#lib-sort').value = 'saved';
        sync(); draw(); form.querySelector('#lib-q').focus();
      });
      return;
    }
    results.innerHTML = `<ul class="stack">${shown.map((p) => {
      const links = state.project === 'all' ? p.links : p.links.filter((l) => l.projectId === state.project);
      return `
      <li class="card lib-item">
        <h2 class="paper__title"><a href="${paperHref(p.id, { project: state.project === 'all' ? '' : state.project })}">${esc(p.title)}</a></h2>
        <p class="paper__authors">${esc(formatAuthors(p.authors))}</p>
        <p class="paper__meta">${[p.year, p.venue].filter(Boolean).map(esc).join(' · ') || 'Year and venue unknown'}</p>
        <ul class="chips" aria-label="Saved in">${links.map((l) => `
          <li class="chip"><span class="chip__name">${esc(nameOf(l.projectId))}</span><span class="chip__status">${STATUS_LABEL[l.status]}${l.hasReview ? ' · Reviewed' : ''}</span></li>`).join('')}</ul>
      </li>`;
    }).join('')}</ul>`;
  }

  /** Keep the filters in the URL (replaceState: no history entry per keystroke) so reload restores them. */
  function sync() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.project !== 'all') p.set('project', state.project);
    if (state.status !== 'any') p.set('status', state.status);
    if (state.sort !== 'saved') p.set('sort', state.sort);
    history.replaceState(null, '', `#/library${p.size ? `?${p}` : ''}`);
  }

  form.addEventListener('submit', (e) => e.preventDefault()); // Enter in the keyword box must not reload the page
  form.addEventListener('input', () => {
    state.q = form.querySelector('#lib-q').value;
    state.project = form.querySelector('#lib-project').value;
    state.status = form.querySelector('#lib-status').value;
    state.sort = form.querySelector('#lib-sort').value;
    sync(); draw();
  });
  draw();
}

/* ============================== Paper detail ============================== */
async function mountDetail(outlet, repo, paperId, ctx) {
  const body = outlet.querySelector('#view-body');
  const h1 = outlet.querySelector('h1');
  const intro = outlet.querySelector('#view-intro');
  const [paper, projects] = await Promise.all([repo.papers.getWithLinks(paperId), repo.projects.list()]);
  if (!ctx.current()) return;
  body.removeAttribute('aria-busy');

  if (!paper) {
    h1.textContent = 'Paper not found';
    document.title = 'Paper not found · SE Research Hub';
    body.innerHTML = '<div class="card empty-state"><p>That paper is not in your library. It may have been removed from its project.</p><a class="btn btn--secondary" href="#/library">Back to the library</a></div>';
    return;
  }

  const query = parseQuery(location.hash);
  const nameOf = (id) => projects.find((p) => p.id === id)?.name ?? 'Deleted project';
  let currentProject = paper.links.some((l) => l.projectId === query.get('project')) ? query.get('project') : paper.links[0].projectId;
  const linkFor = (projectId) => paper.links.find((l) => l.projectId === projectId);

  h1.textContent = paper.title;
  document.title = `${paper.title} · SE Research Hub`;
  intro.textContent = `${formatAuthors(paper.authors)}${paper.year ? ` · ${paper.year}` : ''}`;

  body.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/library">Library</a></li><li aria-current="page">${esc(paper.title)}</li></ol></nav>
    <div class="tabs" id="paper-tabs">
      <div role="tablist" aria-label="Paper sections" class="tabs__list">
        <button type="button" role="tab" id="tab-overview" data-tab="overview" aria-controls="panel-overview" class="tabs__tab">Overview</button>
        <button type="button" role="tab" id="tab-review" data-tab="review" aria-controls="panel-review" class="tabs__tab">Review</button>
      </div>
      <section role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" tabindex="0" class="tabs__panel card">${overviewHtml(paper, nameOf)}</section>
      <section role="tabpanel" id="panel-review" aria-labelledby="tab-review" class="tabs__panel card" hidden></section>
    </div>`;

  const reviewPanel = body.querySelector('#panel-review');
  let dirty = false;

  function setUrl(tab) {
    const href = paperHref(paper.id, { tab, project: paper.links.length > 1 ? currentProject : '' });
    history.replaceState(null, '', href);
  }

  function drawReview() {
    const link = linkFor(currentProject);
    const r = link.review ?? {};
    const status = link.status ?? 'unread';
    const projectPicker = paper.links.length > 1
      ? `<div class="field"><label class="field__label" for="rv-project">Reviewing in project</label>
           <p class="field__hint" id="rv-project-hint">Each project keeps its own review of this paper.</p>
           <select id="rv-project" aria-describedby="rv-project-hint">${paper.links.map((l) => `<option value="${esc(l.projectId)}"${l.projectId === currentProject ? ' selected' : ''}>${esc(nameOf(l.projectId))}</option>`).join('')}</select></div>`
      : `<p class="review__project">Project: <a href="#/projects/${esc(currentProject)}">${esc(nameOf(currentProject))}</a></p>`;

    const area = (key, label, hint, rows = 3) => field({ id: `rv-${key}`, label, hint, control: 'textarea', rows, value: r[key] ?? '', maxlength: REVIEW_MAX, counter: true });

    reviewPanel.innerHTML = `
      <h2 class="visually-hidden">Review</h2>
      ${projectPicker}
      <form id="review-form" class="form">
        <fieldset class="radio-group">
          <legend>Reading status</legend>
          ${Object.entries(STATUS_LABEL).map(([v, label]) => `
            <div class="radio"><input type="radio" id="rv-status-${v}" name="rv-status" value="${v}"${v === status ? ' checked' : ''}><label for="rv-status-${v}">${label}</label></div>`).join('')}
        </fieldset>
        ${area('studyAim', 'Study aim', 'What question did the authors set out to answer?')}
        ${area('methodology', 'Methodology', 'Study design, how data was collected and how it was analysed.')}
        ${area('participants', 'Participants or dataset', 'Who or what was studied, and how many.')}
        ${area('keyFindings', 'Key findings', 'What the paper reports, in its own terms. Put your own interpretation in the notes below.', 4)}
        ${area('limitations', 'Limitations and threats to validity', 'Weaknesses the authors state, and any you notice.')}
        ${area('notes', 'General notes', 'Anything else worth remembering, including your own interpretation.', 4)}
        <p class="form-status" role="alert"></p>
        <div class="actions"><button type="submit" class="btn btn--primary">Save review</button>
          <span class="review__saved" id="review-saved">${link.reviewedAt ? `Last saved ${formatDate(link.reviewedAt)}` : 'Not saved yet'}</span></div>
      </form>`;
    dirty = false;

    const form = reviewPanel.querySelector('#review-form');
    form.addEventListener('input', () => { dirty = true; });
    wireForm(form, async (v) => {
      const updated = await repo.papers.saveReview(currentProject, paper.id, {
        status: v['rv-status'], studyAim: v['rv-studyAim'], methodology: v['rv-methodology'], participants: v['rv-participants'],
        keyFindings: v['rv-keyFindings'], limitations: v['rv-limitations'], notes: v['rv-notes'],
      });
      Object.assign(linkFor(currentProject), { status: updated.status, review: updated.review, reviewedAt: updated.reviewedAt });
      dirty = false;
      reviewPanel.querySelector('#review-saved').textContent = `Last saved ${formatDate(updated.reviewedAt)}`;
      showToast('Review saved');
    });

    reviewPanel.querySelector('#rv-project')?.addEventListener('change', async (e) => {
      const next = e.target.value;
      if (dirty) {
        const ok = await confirmAction({ title: 'Discard unsaved changes?', body: `Your changes to the review in “${nameOf(currentProject)}” have not been saved.`, confirmLabel: 'Discard changes' });
        if (!ok) { e.target.value = currentProject; return; }
      }
      currentProject = next;
      setUrl('review');
      drawReview();
      reviewPanel.querySelector('#rv-project').focus();
    });
  }

  drawReview();
  initTabs(body.querySelector('#paper-tabs'), { initial: query.get('tab') === 'review' ? 'review' : 'overview', onChange: setUrl });
}

function overviewHtml(p, nameOf) {
  const link = (url, text) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="visually-hidden"> (opens in a new tab)</span></a>` : '';
  const facts = [
    ['Authors', p.authors.length ? esc(p.authors.join(', ')) : 'Unknown'],
    ['Year', p.year ?? 'Unknown'],
    ['Venue', p.venue ? esc(p.venue) : 'Unknown'],
    ['Type', p.type ? esc(p.type) : 'Unknown'],
    ['DOI', p.doi ? link(`https://doi.org/${p.doi}`, p.doi) : 'None recorded'],
    ['Citations', new Intl.NumberFormat('en-GB').format(p.citedBy)],
    ['Access', p.isOa ? esc(OA_LABEL[p.oaStatus] ?? 'Open access') : 'Not known to be open access'],
    ['Found in', p.sources.map((s) => esc(SOURCE_LABEL[s] ?? s)).join(', ') || 'Unknown'],
  ];
  return `
    <h2 class="visually-hidden">Overview</h2>
    <dl class="facts">${facts.map(([k, v]) => `<div class="facts__row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <h3>Abstract</h3>
    ${p.abstract ? `<p>${esc(p.abstract)}</p>` : '<p class="paper__noabstract">No abstract is available for this paper.</p>'}
    <h3>Read the paper</h3>
    <p class="actions">${[link(p.url, 'Publisher page'), link(p.oaUrl, 'Open-access full text')].filter(Boolean).map((a) => `<span class="btn btn--secondary btn--small btn--link">${a}</span>`).join('') || 'No link available.'}</p>
    <h3>Saved in</h3>
    <ul class="chips">${p.links.map((l) => `
      <li class="chip"><a class="chip__name" href="#/projects/${esc(l.projectId)}">${esc(nameOf(l.projectId))}</a><span class="chip__status">${STATUS_LABEL[l.status]} · saved ${formatDate(l.addedAt)}</span></li>`).join('')}</ul>`;
}

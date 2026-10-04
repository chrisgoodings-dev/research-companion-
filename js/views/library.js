import { getRepo } from '../db/index.js';
import { filterPapers, LIB_SORTS, LIB_STATUSES } from '../library.js';
import { REVIEW_MAX } from '../validation.js';
import { formatAuthors } from '../api/paper.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { field } from '../ui/fields.js';
import { wireForm, isDirty, markClean } from '../ui/forms.js';
import { announce } from '../ui/announcer.js';
import { showToast } from '../ui/toast.js';
import { confirmAction } from '../ui/confirm.js';
import { initTabs } from '../ui/tabs.js';
import { evidenceCard, evidenceForm, evidenceChecks, readEvidence } from '../ui/evidenceUi.js';
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
    <div id="lib-filters" class="card form" role="search" aria-label="Filter saved papers">
      ${field({ id: 'lib-q', label: 'Filter by keyword', hint: 'Matches title, authors, venue, year or DOI.', type: 'search', value: state.q, maxlength: 200, optionalTag: false })}
      <div class="filters__grid">
        <div class="field"><label class="field__label" for="lib-project">Project</label>
          <select id="lib-project" name="lib-project">${`<option value="all">All projects</option>${projects.map((p) => `<option value="${esc(p.id)}"${p.id === state.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}`}</select></div>
        <div class="field"><label class="field__label" for="lib-status">Reading status</label>
          <select id="lib-status" name="lib-status">${options(LIB_STATUSES, state.status)}</select></div>
        <div class="field"><label class="field__label" for="lib-sort">Sort by</label>
          <select id="lib-sort" name="lib-sort">${options(LIB_SORTS, state.sort)}</select></div>
      </div>
    </div>
    <p id="lib-count" class="results__summary" role="status"></p>
    <div id="lib-results"></div>`;

  const form = body.querySelector('#lib-filters'); // a search container, not a <form>: filtering is live, nothing is submitted
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
  let currentTab = ['review', 'evidence'].includes(query.get('tab')) ? query.get('tab') : 'overview';
  const linkFor = (projectId) => paper.links.find((l) => l.projectId === projectId);

  h1.textContent = paper.title;
  document.title = `${paper.title} · SE Research Hub`;
  intro.textContent = `${formatAuthors(paper.authors)}${paper.year ? ` · ${paper.year}` : ''}`;

  // The Review and Evidence tabs both work inside ONE project, chosen here (above the tabs).
  const context = paper.links.length > 1
    ? `<div class="field paper-ctx"><label class="field__label" for="paper-project">Working in project</label>
         <p class="field__hint" id="paper-project-hint">Applies to the Review and Evidence tabs. Each project keeps its own review and evidence for this paper.</p>
         <select id="paper-project" aria-describedby="paper-project-hint">${paper.links.map((l) => `<option value="${esc(l.projectId)}"${l.projectId === currentProject ? ' selected' : ''}>${esc(nameOf(l.projectId))}</option>`).join('')}</select></div>`
    : `<p class="paper-ctx review__project">Project: <a href="#/projects/${esc(currentProject)}">${esc(nameOf(currentProject))}</a></p>`;

  body.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/library">Library</a></li><li aria-current="page">${esc(paper.title)}</li></ol></nav>
    ${context}
    <div class="tabs" id="paper-tabs">
      <div role="tablist" aria-label="Paper sections" class="tabs__list">
        <button type="button" role="tab" id="tab-overview" data-tab="overview" aria-controls="panel-overview" class="tabs__tab">Overview</button>
        <button type="button" role="tab" id="tab-review" data-tab="review" aria-controls="panel-review" class="tabs__tab">Review</button>
        <button type="button" role="tab" id="tab-evidence" data-tab="evidence" aria-controls="panel-evidence" class="tabs__tab">Evidence</button>
      </div>
      <section role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" tabindex="0" class="tabs__panel card">${overviewHtml(paper, nameOf)}</section>
      <section role="tabpanel" id="panel-review" aria-labelledby="tab-review" class="tabs__panel card" hidden></section>
      <section role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence" class="tabs__panel card" hidden></section>
    </div>`;

  const reviewPanel = body.querySelector('#panel-review');
  const evidencePanel = body.querySelector('#panel-evidence');

  function setUrl() {
    history.replaceState(null, '', paperHref(paper.id, { tab: currentTab, project: paper.links.length > 1 ? currentProject : '' }));
  }

  /* ----- Review tab ----- */
  function drawReview() {
    const link = linkFor(currentProject);
    const r = link.review ?? {};
    const status = link.status ?? 'unread';
    const area = (key, label, hint, rows = 3) => field({ id: `rv-${key}`, label, hint, control: 'textarea', rows, value: r[key] ?? '', maxlength: REVIEW_MAX, counter: true });

    reviewPanel.innerHTML = `
      <h2 class="visually-hidden">Review</h2>
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

    const form = reviewPanel.querySelector('#review-form');
    wireForm(form, async (v) => {
      const updated = await repo.papers.saveReview(currentProject, paper.id, {
        status: v['rv-status'], studyAim: v['rv-studyAim'], methodology: v['rv-methodology'], participants: v['rv-participants'],
        keyFindings: v['rv-keyFindings'], limitations: v['rv-limitations'], notes: v['rv-notes'],
      });
      Object.assign(linkFor(currentProject), { status: updated.status, review: updated.review, reviewedAt: updated.reviewedAt });
      markClean(form);
      reviewPanel.querySelector('#review-saved').textContent = `Last saved ${formatDate(updated.reviewedAt)}`;
      showToast('Review saved');
    });
  }

  /* ----- Evidence tab ----- */
  async function drawEvidence(focus) {
    const [questions, records] = await Promise.all([repo.questions.listByProject(currentProject), repo.evidence.listByPaper(currentProject, paper.id)]);
    const rqIndex = new Map(questions.map((q, i) => [q.id, { label: `RQ${i + 1}`, text: q.text }]));

    if (!questions.length) {
      evidencePanel.innerHTML = `<h2 class="visually-hidden">Evidence</h2><div class="empty-state"><h3>Add a research question first</h3>
        <p>Evidence is recorded against a research question, and “${esc(nameOf(currentProject))}” does not have one yet.</p>
        <a class="btn btn--primary" href="#/projects/${esc(currentProject)}">Add research questions</a></div>`;
      return;
    }

    evidencePanel.innerHTML = `
      <h2 class="visually-hidden">Evidence</h2>
      <form id="ev-add" class="form ev-form">
        <h3>Add evidence</h3>
        ${evidenceForm('ev-new', { questions, submitLabel: 'Add evidence' })}
      </form>
      <h3 id="ev-list-h" tabindex="-1" class="section-gap">Recorded evidence (${records.length})</h3>
      ${records.length ? `<ul class="stack">${records.map((e) => evidenceCard(e, {
        ...(rqIndex.get(e.researchQuestionId) ? { rqLabel: rqIndex.get(e.researchQuestionId).label, rqText: rqIndex.get(e.researchQuestionId).text } : { rqLabel: 'RQ?', rqText: 'Question no longer exists' }),
        actionsHtml: `<div class="actions">
          <button type="button" class="btn btn--secondary btn--small" data-ev-edit="${esc(e.id)}">Edit<span class="visually-hidden"> evidence for ${esc(rqIndex.get(e.researchQuestionId)?.label ?? 'question')}</span></button>
          <button type="button" class="btn btn--danger-outline btn--small" data-ev-delete="${esc(e.id)}">Delete<span class="visually-hidden"> evidence for ${esc(rqIndex.get(e.researchQuestionId)?.label ?? 'question')}</span></button></div>`,
      })).join('')}</ul>` : '<p class="empty-state">No evidence recorded for this paper in this project yet.</p>'}`;

    const addForm = evidencePanel.querySelector('#ev-add');
    wireForm(addForm, async (v) => {
      await repo.evidence.create({ projectId: currentProject, paperId: paper.id, ...readEvidence('ev-new', v) });
      showToast('Evidence added');
      await drawEvidence('#ev-new-rq');
    }, { crossChecks: evidenceChecks('ev-new') });

    evidencePanel.querySelectorAll('[data-ev-edit]').forEach((btn) => btn.addEventListener('click', () => {
      const record = records.find((x) => x.id === btn.dataset.evEdit);
      const li = btn.closest('.ev');
      const prefix = `ev-edit-${record.id}`;
      li.innerHTML = `<form class="form" id="${prefix}-form"><h3>Edit evidence</h3>${evidenceForm(prefix, { record, questions, submitLabel: 'Save changes' })}</form>`;
      li.querySelector(`#${prefix}-rq`).focus();
      const back = () => drawEvidence(`[data-ev-edit="${record.id}"]`);
      li.querySelector('[data-cancel-edit]').addEventListener('click', back);
      wireForm(li.querySelector('form'), async (v) => {
        await repo.evidence.update(record.id, readEvidence(prefix, v));
        showToast('Evidence saved');
        await drawEvidence(`[data-ev-edit="${record.id}"]`);
      }, { crossChecks: evidenceChecks(prefix) });
    }));

    evidencePanel.querySelectorAll('[data-ev-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const record = records.find((x) => x.id === btn.dataset.evDelete);
      const ok = await confirmAction({ title: 'Delete this evidence?', body: `“${record.evidence.slice(0, 120)}${record.evidence.length > 120 ? '…' : ''}” will be removed. This cannot be undone.`, confirmLabel: 'Delete evidence' });
      if (!ok) return;
      await repo.evidence.remove(record.id);
      showToast('Evidence deleted');
      await drawEvidence('#ev-list-h');
    }));

    if (focus) evidencePanel.querySelector(focus)?.focus();
  }

  /* ----- project switching (shared by Review and Evidence) ----- */
  body.querySelector('#paper-project')?.addEventListener('change', async (e) => {
    const picker = e.target;
    const next = picker.value;
    if (isDirty(reviewPanel) || isDirty(evidencePanel)) {
      const ok = await confirmAction({ title: 'Discard unsaved changes?', body: `You have unsaved text for “${nameOf(currentProject)}”. Switching project will discard it.`, confirmLabel: 'Discard changes' });
      if (!ok) { picker.value = currentProject; return; }
    }
    currentProject = next;
    setUrl();
    drawReview();
    await drawEvidence();
    picker.focus();
  });

  drawReview();
  await drawEvidence();
  initTabs(body.querySelector('#paper-tabs'), { initial: currentTab, onChange: (tab) => { currentTab = tab; setUrl(); } });
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

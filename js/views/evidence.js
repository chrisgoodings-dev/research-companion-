import { getRepo } from '../db/index.js';
import { filterEvidence, countByRelationship, allTags } from '../evidence.js';
import { RELATIONSHIPS } from '../validation.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { field } from '../ui/fields.js';
import { evidenceCard } from '../ui/evidenceUi.js';
import { REL_LABEL, plural } from '../ui/format.js';

export const evidenceRoute = {
  title: 'Evidence',
  render: () => `
    <div class="page-header"><h1>Evidence</h1><p id="view-intro"></p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,

  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    const body = outlet.querySelector('#view-body');
    outlet.querySelector('#view-intro').textContent = 'Everything you have recorded, across your projects: what each paper reports, tied to a research question.';

    const [records, projects, papers] = await Promise.all([repo.evidence.listAll(), repo.projects.list(), repo.papers.listAll()]);
    if (!ctx.current()) return;
    body.removeAttribute('aria-busy');

    if (!records.length) {
      body.innerHTML = `<div class="card empty-state"><h2>No evidence recorded yet</h2>
        <p>Open a saved paper in the Library and use its Evidence tab to record what it reports against a research question.</p>
        <a class="btn btn--primary" href="#/library">Go to the library</a></div>`;
      return;
    }

    // Lookups: question id -> { label (RQ1), text, projectId } and paper id -> title
    const questionsByProject = new Map();
    const rq = new Map();
    for (const p of projects) {
      const list = await repo.questions.listByProject(p.id);
      questionsByProject.set(p.id, list);
      list.forEach((q, i) => rq.set(q.id, { label: `RQ${i + 1}`, text: q.text, projectId: p.id }));
    }
    const titles = Object.fromEntries(papers.map((p) => [p.id, p.title]));
    const projectName = (id) => projects.find((p) => p.id === id)?.name ?? 'Deleted project';
    const tags = allTags(records);

    const q = parseQuery(location.hash);
    const state = {
      q: q.get('q') ?? '',
      project: projects.some((p) => p.id === q.get('project')) ? q.get('project') : 'all',
      question: rq.has(q.get('rq')) ? q.get('rq') : 'all',
      paper: Object.hasOwn(titles, q.get('paper')) ? q.get('paper') : 'all',
      relationship: RELATIONSHIPS.includes(q.get('rel')) ? q.get('rel') : 'any',
      tag: tags.includes(q.get('tag')) ? q.get('tag') : 'any',
    };

    const questionOptions = () => {
      const groups = projects.filter((p) => state.project === 'all' || p.id === state.project).map((p) => `
        <optgroup label="${esc(p.name)}">${questionsByProject.get(p.id).map((qq, i) => `<option value="${esc(qq.id)}"${qq.id === state.question ? ' selected' : ''}>RQ${i + 1}: ${esc(qq.text.length > 70 ? `${qq.text.slice(0, 69)}…` : qq.text)}</option>`).join('')}</optgroup>`).join('');
      return `<option value="all">All research questions</option>${groups}`;
    };
    const select = (id, label, options) => `<div class="field"><label class="field__label" for="${id}">${label}</label><select id="${id}" name="${id}">${options}</select></div>`;

    body.innerHTML = `
      <form id="ev-filters" class="card form" role="search" aria-label="Filter evidence">
        ${field({ id: 'ef-q', label: 'Filter by keyword', hint: 'Matches the evidence, your interpretation, location, tags and paper title.', type: 'search', value: state.q, maxlength: 200, optionalTag: false })}
        <div class="filters__grid">
          ${select('ef-project', 'Project', `<option value="all">All projects</option>${projects.map((p) => `<option value="${esc(p.id)}"${p.id === state.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}`)}
          <div class="field" id="ef-question-wrap"></div>
          ${select('ef-paper', 'Paper', `<option value="all">All papers</option>${[...new Set(records.map((e) => e.paperId))].map((id) => `<option value="${esc(id)}"${id === state.paper ? ' selected' : ''}>${esc(titles[id] ?? 'Unknown paper')}</option>`).join('')}`)}
          ${select('ef-rel', 'Relationship', `<option value="any">Any relationship</option>${RELATIONSHIPS.map((r) => `<option value="${r}"${r === state.relationship ? ' selected' : ''}>${REL_LABEL[r]}</option>`).join('')}`)}
          ${select('ef-tag', 'Tag', `<option value="any">Any tag</option>${tags.map((t) => `<option value="${esc(t)}"${t === state.tag ? ' selected' : ''}>${esc(t)}</option>`).join('')}`)}
        </div>
      </form>
      <p id="ef-count" class="results__summary" role="status"></p>
      <p id="ef-breakdown" class="rel-counts"></p>
      <div id="ef-results"></div>`;

    const form = body.querySelector('#ev-filters');
    const count = body.querySelector('#ef-count');
    const breakdown = body.querySelector('#ef-breakdown');
    const results = body.querySelector('#ef-results');
    let timer;

    const drawQuestionSelect = () => {
      body.querySelector('#ef-question-wrap').innerHTML = `<label class="field__label" for="ef-question">Research question</label><select id="ef-question" name="ef-question">${questionOptions()}</select>`;
    };
    drawQuestionSelect();

    function draw() {
      const shown = filterEvidence(records, titles, state);
      const message = `${plural(shown.length, 'evidence record')} shown${shown.length === records.length ? '' : ` of ${records.length}`}.`;
      clearTimeout(timer);
      timer = setTimeout(() => { count.textContent = message; }, 350);
      if (!count.textContent) count.textContent = message;
      const counts = countByRelationship(shown);
      breakdown.textContent = RELATIONSHIPS.map((r) => `${REL_LABEL[r]} ${counts[r]}`).join(' · ');

      if (!shown.length) {
        results.innerHTML = `<div class="card empty-state"><h2>No evidence matches</h2><p>Try different keywords or clear the filters.</p><button type="button" class="btn btn--secondary" id="ef-clear">Clear filters</button></div>`;
        results.querySelector('#ef-clear').addEventListener('click', () => {
          Object.assign(state, { q: '', project: 'all', question: 'all', paper: 'all', relationship: 'any', tag: 'any' });
          form.querySelector('#ef-q').value = ''; form.querySelector('#ef-project').value = 'all';
          form.querySelector('#ef-rel').value = 'any'; form.querySelector('#ef-tag').value = 'any'; form.querySelector('#ef-paper').value = 'all';
          drawQuestionSelect(); sync(); draw(); form.querySelector('#ef-q').focus();
        });
        return;
      }
      results.innerHTML = `<ul class="stack">${shown.map((e) => {
        const r = rq.get(e.researchQuestionId) ?? { label: 'RQ?', text: 'Question no longer exists' };
        return evidenceCard(e, {
          rqLabel: `${projectName(e.projectId)} · ${r.label}`,
          rqText: r.text,
          paperHtml: `<p class="ev__paper">Paper: <a href="#/library/${encodeURIComponent(e.paperId)}?tab=evidence&amp;project=${esc(e.projectId)}">${esc(titles[e.paperId] ?? 'Unknown paper')}</a></p>`,
        });
      }).join('')}</ul>`;
    }

    function sync() {
      const p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.project !== 'all') p.set('project', state.project);
      if (state.question !== 'all') p.set('rq', state.question);
      if (state.paper !== 'all') p.set('paper', state.paper);
      if (state.relationship !== 'any') p.set('rel', state.relationship);
      if (state.tag !== 'any') p.set('tag', state.tag);
      history.replaceState(null, '', `#/evidence${p.size ? `?${p}` : ''}`);
    }

    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('input', (e) => {
      state.q = form.querySelector('#ef-q').value;
      const projectChanged = state.project !== form.querySelector('#ef-project').value;
      state.project = form.querySelector('#ef-project').value;
      if (projectChanged) { state.question = 'all'; drawQuestionSelect(); } else { state.question = form.querySelector('#ef-question').value; }
      state.paper = form.querySelector('#ef-paper').value;
      state.relationship = form.querySelector('#ef-rel').value;
      state.tag = form.querySelector('#ef-tag').value;
      sync(); draw();
      if (projectChanged && e.target.id === 'ef-project') form.querySelector('#ef-project').focus();
    });
    draw();
  },
};

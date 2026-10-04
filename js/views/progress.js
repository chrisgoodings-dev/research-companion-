import { getRepo } from '../db/index.js';
import { buildProgress } from '../progress.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { REL_LABEL, plural } from '../ui/format.js';
import { RELATIONSHIPS } from '../validation.js';
import { describeCounts } from '../matrix.js';

const paperLink = (p, projectId) => `<a href="#/library/${encodeURIComponent(p.id)}?tab=review&amp;project=${esc(projectId)}">${esc(p.title)}</a>`;

export const progressRoute = {
  title: 'Progress',
  render: () => `
    <div class="page-header"><h1>Progress</h1><p id="view-intro"></p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,

  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    const body = outlet.querySelector('#view-body');
    outlet.querySelector('#view-intro').textContent = 'How far each project’s review has got, and what to do next.';
    const projects = await repo.projects.list();
    if (!ctx.current()) return;
    body.removeAttribute('aria-busy');

    if (!projects.length) {
      body.innerHTML = '<div class="card empty-state"><h2>No projects yet</h2><p>Create a project to track your progress.</p><a class="btn btn--primary" href="#/projects">Go to Projects</a></div>';
      return;
    }
    const wanted = parseQuery(location.hash).get('project');
    let projectId = projects.some((p) => p.id === wanted) ? wanted : projects[0].id;

    body.innerHTML = `
      <form id="progress-form" class="card form" aria-label="Choose a project">
        <div class="field"><label class="field__label" for="progress-project">Project</label>
          <select id="progress-project">${projects.map((p) => `<option value="${esc(p.id)}"${p.id === projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      </form>
      <div id="progress-out"></div>`;
    const out = body.querySelector('#progress-out');
    body.querySelector('#progress-form').addEventListener('submit', (e) => e.preventDefault());
    body.querySelector('#progress-project').addEventListener('change', (e) => { projectId = e.target.value; history.replaceState(null, '', `#/progress?project=${projectId}`); draw(); });

    async function draw() {
      const [questions, papers, evidence] = await Promise.all([repo.questions.listByProject(projectId), repo.papers.listByProject(projectId), repo.evidence.listByProject(projectId)]);
      if (!ctx.current()) return;
      const p = buildProgress({ papers, questions, evidence });

      const bar = (id, value, max, label) => `<div class="meter"><p id="${id}-l" class="meter__label">${label}</p><progress id="${id}" aria-labelledby="${id}-l" value="${value}" max="${Math.max(max, 1)}">${value} of ${max}</progress></div>`;

      out.innerHTML = `
        <ul class="card-grid" aria-label="Summary">
          <li class="card stat"><span class="stat__value">${p.papers.total}</span><span class="stat__label">Saved papers</span></li>
          <li class="card stat"><span class="stat__value">${p.papers.read}</span><span class="stat__label">Read</span></li>
          <li class="card stat"><span class="stat__value">${p.papers.reviewed}</span><span class="stat__label">With a review</span></li>
          <li class="card stat"><span class="stat__value">${p.evidenceCount}</span><span class="stat__label">Evidence records</span></li>
        </ul>

        <section class="card" aria-labelledby="next-h">
          <h2 id="next-h">What to do next</h2>
          ${p.suggestions.length ? `<ul class="steps">${p.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p>Nothing outstanding.</p>'}
        </section>

        <section class="card section-gap" aria-labelledby="read-h">
          <h2 id="read-h">Reading progress</h2>
          ${bar('read-bar', p.papers.read, p.papers.total, `${p.papers.read} of ${plural(p.papers.total, 'paper')} read (${p.papers.percentRead}%)`)}
          <p class="review__saved">Unread ${p.papers.unread} · Reading ${p.papers.reading} · Read ${p.papers.read}</p>
          ${p.unreadPapers.length ? `<h3>Not read yet</h3><ul class="steps">${p.unreadPapers.map((x) => `<li>${paperLink(x, projectId)}</li>`).join('')}</ul>` : ''}
          ${p.readWithoutEvidence.length ? `<h3>Read, but no evidence recorded</h3><ul class="steps">${p.readWithoutEvidence.map((x) => `<li>${paperLink(x, projectId)}</li>`).join('')}</ul>` : ''}
        </section>

        <section class="section-gap" aria-labelledby="cov-h">
          <h2 id="cov-h">Evidence by research question</h2>
          ${p.questions.length ? `<ul class="stack">${p.questions.map((q) => `
            <li class="card">
              <p class="ev__rq"><span class="badge">${esc(q.label)}</span> ${esc(q.text)}</p>
              ${bar(`cov-${q.id}`, q.papersWithEvidence, p.papers.total, `Evidence from ${q.papersWithEvidence} of ${plural(p.papers.total, 'paper')}`)}
              <p class="review__saved">${esc(q.evidenceCount ? describeCounts(q.counts, REL_LABEL) : 'No evidence recorded')}</p>
              ${q.conflict ? '<p><strong class="matrix__conflict"><span aria-hidden="true">⚠</span> Evidence conflicts</strong></p>' : ''}
              ${q.evidenceCount ? `<a href="#/evidence?project=${esc(projectId)}&amp;rq=${esc(q.id)}">View ${plural(q.evidenceCount, 'evidence record')}<span class="visually-hidden"> for ${esc(q.label)}</span></a>` : ''}
            </li>`).join('')}</ul>` : '<p class="card empty-state">This project has no research questions yet.</p>'}
        </section>
        <p class="section-gap"><a class="btn btn--secondary" href="#/matrix?project=${esc(projectId)}">Open the evidence matrix</a></p>`;
    }
    await draw();
  },
};

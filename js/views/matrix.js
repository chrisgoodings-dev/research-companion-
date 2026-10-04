import { getRepo } from '../db/index.js';
import { buildMatrix, describeCounts } from '../matrix.js';
import { RELATIONSHIPS } from '../validation.js';
import { formatAuthors } from '../api/paper.js';
import { parseQuery } from '../router.js';
import { esc } from '../ui/dom.js';
import { announce } from '../ui/announcer.js';
import { relBadge } from '../ui/evidenceUi.js';
import { REL_LABEL, REL_HELP, plural } from '../ui/format.js';

const evidenceHref = (project, { rq, paper } = {}) => {
  const p = new URLSearchParams({ project });
  if (rq) p.set('rq', rq);
  if (paper) p.set('paper', paper);
  return `#/evidence?${p}`;
};

export const matrixRoute = {
  title: 'Matrix',
  render: () => `
    <div class="page-header"><h1>Evidence matrix</h1><p id="view-intro"></p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,

  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    const body = outlet.querySelector('#view-body');
    outlet.querySelector('#view-intro').textContent = 'Each paper against each research question. See where the evidence agrees, conflicts or is missing.';
    const projects = await repo.projects.list();
    if (!ctx.current()) return;
    body.removeAttribute('aria-busy');

    if (!projects.length) {
      body.innerHTML = `<div class="card empty-state"><h2>No projects yet</h2><p>Create a project, add research questions and record evidence to see the matrix.</p><a class="btn btn--primary" href="#/projects">Go to Projects</a></div>`;
      return;
    }

    const wanted = parseQuery(location.hash).get('project');
    let projectId = projects.some((p) => p.id === wanted) ? wanted : projects[0].id;

    body.innerHTML = `
      <div id="matrix-form" class="card form" role="group" aria-label="Choose a project">
        <div class="field"><label class="field__label" for="matrix-project">Project</label>
          <select id="matrix-project" name="matrix-project">${projects.map((p) => `<option value="${esc(p.id)}"${p.id === projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <div id="matrix-out"></div>`;
    const out = body.querySelector('#matrix-out');
    body.querySelector('#matrix-project').addEventListener('change', (e) => {
      projectId = e.target.value;
      history.replaceState(null, '', `#/matrix?project=${projectId}`);
      draw().then(() => announce(`Evidence matrix for ${projects.find((p) => p.id === projectId).name}`));
    });

    async function draw() {
      const project = projects.find((p) => p.id === projectId);
      const [questions, papers, evidence] = await Promise.all([repo.questions.listByProject(projectId), repo.papers.listByProject(projectId), repo.evidence.listByProject(projectId)]);
      if (!ctx.current()) return;

      if (!questions.length || !papers.length) {
        out.innerHTML = `<div class="card empty-state"><h2>The matrix needs ${!questions.length ? 'research questions' : 'saved papers'}</h2>
          <p>${!questions.length ? `“${esc(project.name)}” has no research questions yet.` : `“${esc(project.name)}” has no saved papers yet.`}</p>
          <a class="btn btn--primary" href="${!questions.length ? `#/projects/${esc(projectId)}` : '#/discover'}">${!questions.length ? 'Add research questions' : 'Find papers'}</a></div>`;
        return;
      }

      // Alphabetical rows: a stable order that makes a paper easy to find (newest-first would shuffle as you save).
      papers.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
      const m = buildMatrix({ papers, questions, evidence });
      const total = m.summary.reduce((n, s) => n + s.total, 0);

      const cell = (row, col, i) => {
        const c = row.cells[i];
        if (!c.total) return '<td class="matrix__empty"><span aria-hidden="true">—</span><span class="visually-hidden">No evidence recorded</span></td>';
        const badges = RELATIONSHIPS.filter((r) => c.counts[r]).map((r) => `<li>${relBadge(r)}${c.counts[r] > 1 ? `<span class="matrix__n"> (${c.counts[r]})</span>` : ''}</li>`).join('');
        return `<td><a class="matrix__link" href="${evidenceHref(projectId, { rq: col.question.id, paper: row.paper.id })}"><ul class="matrix__rels">${badges}</ul><span class="visually-hidden">for ${esc(col.label)}, ${esc(row.paper.title)}: ${esc(describeCounts(c.counts, REL_LABEL))}. View evidence.</span></a></td>`;
      };

      const summaryCell = (s, col) => `<td class="matrix__sum">
          <a class="matrix__link" href="${evidenceHref(projectId, { rq: col.question.id })}">
            <span class="matrix__papers">${s.papersWithEvidence} of ${papers.length} papers</span>
            <span class="matrix__counts">${esc(s.total ? describeCounts(s.counts, REL_LABEL) : 'No evidence recorded')}</span>
            ${s.conflict ? '<strong class="matrix__conflict"><span aria-hidden="true">⚠</span> Evidence conflicts</strong>' : ''}
            <span class="visually-hidden">for ${esc(col.label)}. View evidence.</span>
          </a></td>`;

      const notes = [
        ...m.summary.map((s, i) => (s.conflict ? `${m.columns[i].label}: evidence conflicts (${describeCounts(s.counts, REL_LABEL)}).` : '')).filter(Boolean),
        m.gaps.questionsWithoutEvidence.length ? `No evidence yet for: ${m.gaps.questionsWithoutEvidence.map((q) => m.columns.find((c) => c.question.id === q.id).label).join(', ')}.` : '',
        m.gaps.papersWithoutEvidence.length ? `${plural(m.gaps.papersWithoutEvidence.length, 'saved paper')} with no evidence recorded yet: ${m.gaps.papersWithoutEvidence.map((p) => esc(p.title)).join('; ')}.` : '',
      ].filter(Boolean);

      out.innerHTML = `
        <p class="results__summary">${plural(papers.length, 'paper')} × ${plural(questions.length, 'research question')} · ${plural(total, 'evidence record')}</p>

        ${notes.length ? `<section class="card" aria-labelledby="notes-h"><h2 id="notes-h">What stands out</h2><ul class="steps">${notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>` : ''}

        <section class="table-scroll" aria-labelledby="matrix-cap" tabindex="0">
          <table class="matrix">
            <caption id="matrix-cap">Evidence matrix for “${esc(project.name)}”: how each paper’s evidence relates to each research question</caption>
            <thead><tr><th scope="col" class="matrix__corner">Paper</th>${m.columns.map((c) => `<th scope="col">${esc(c.label)}<span class="visually-hidden">: ${esc(c.question.text)}</span></th>`).join('')}</tr></thead>
            <tbody>${m.rows.map((row) => `
              <tr><th scope="row"><a href="#/library/${encodeURIComponent(row.paper.id)}?tab=evidence&amp;project=${esc(projectId)}">${esc(row.paper.title)}</a>
                  <span class="matrix__sub">${esc(formatAuthors(row.paper.authors, 2))}${row.paper.year ? ` · ${row.paper.year}` : ''}</span></th>
                ${m.columns.map((col, i) => cell(row, col, i)).join('')}</tr>`).join('')}</tbody>
            <tfoot><tr><th scope="row">All papers</th>${m.summary.map((s, i) => summaryCell(s, m.columns[i])).join('')}</tr></tfoot>
          </table>
        </section>

        <section class="card key" aria-labelledby="key-h">
          <h2 id="key-h">Key</h2>
          <ul class="key__list">${RELATIONSHIPS.map((r) => `<li>${relBadge(r)} <span>${esc(REL_HELP[r])}</span></li>`).join('')}
            <li><span class="matrix__dash" aria-hidden="true">—</span> <span>No evidence recorded for this paper and question.</span></li></ul>
          <h3>Research questions</h3>
          <dl class="key__questions">${m.columns.map((c) => `<div><dt>${esc(c.label)}</dt><dd>${esc(c.question.text)}</dd></div>`).join('')}</dl>
        </section>`;
    }
    await draw();
  },
};

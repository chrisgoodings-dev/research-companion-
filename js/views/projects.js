import { getRepo } from '../db/index.js';
import { LIMITS } from '../validation.js';
import { esc } from '../ui/dom.js';
import { field } from '../ui/fields.js';
import { wireForm } from '../ui/forms.js';
import { showToast } from '../ui/toast.js';
import { confirmAction } from '../ui/confirm.js';

const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const projectFields = (prefix, p = {}) =>
  field({ id: `${prefix}-name`, label: 'Project name', hint: `${LIMITS.projectName.min} to ${LIMITS.projectName.max} characters, for example "AI-assisted coding and productivity".`, value: p.name ?? '', required: true, minlength: LIMITS.projectName.min, maxlength: LIMITS.projectName.max, counter: true }) +
  field({ id: `${prefix}-description`, label: 'Description', hint: `What is this review about? Up to ${LIMITS.projectDescription.max} characters.`, control: 'textarea', rows: 3, value: p.description ?? '', maxlength: LIMITS.projectDescription.max, counter: true });

/* ---------- Project list (#/projects) ---------- */
export const projectsRoute = {
  title: 'Projects',
  render: (params) => `
    <div class="page-header"><h1>${params[0] ? 'Project' : 'Projects'}</h1><p id="view-intro"></p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,
  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    if (params[0]) await mountDetail(outlet, repo, params[0], ctx);
    else await mountList(outlet, repo);
  },
};

async function mountList(outlet, repo) {
  const body = outlet.querySelector('#view-body');
  outlet.querySelector('#view-intro').textContent = 'A project is one literature review. Add the research questions it needs to answer.';
  const projects = await repo.projects.list();
  const counts = await Promise.all(projects.map(async (p) => (await repo.questions.listByProject(p.id)).length));

  const cards = projects.map((p, i) => `
      <li class="card project-card">
        <h3 class="project-card__title"><a href="#/projects/${esc(p.id)}">${esc(p.name)}</a></h3>
        ${p.description ? `<p class="project-card__desc">${esc(p.description)}</p>` : ''}
        <p class="project-card__meta">${plural(counts[i], 'research question')} · Updated ${date(p.updatedAt)}</p>
      </li>`).join('');

  body.removeAttribute('aria-busy');
  body.innerHTML = `
    <div class="two-col">
      <section aria-labelledby="list-h">
        <h2 id="list-h">Your projects</h2>
        ${projects.length ? `<ul class="stack">${cards}</ul>` : `
          <div class="card empty-state"><h3>No projects yet</h3><p>Create your first project using the form to start recording research questions.</p></div>`}
      </section>
      <section class="card" aria-labelledby="new-h">
        <h2 id="new-h">New project</h2>
        <form id="new-project" class="form">
          ${projectFields('new')}
          <p class="form-status" role="alert"></p>
          <button type="submit" class="btn btn--primary">Create project</button>
        </form>
      </section>
    </div>`;

  wireForm(body.querySelector('#new-project'), async (v) => {
    const project = await repo.projects.create({ name: v['new-name'], description: v['new-description'] });
    showToast(`Project “${project.name}” created`);
    location.hash = `#/projects/${project.id}`;
  });
}

/* ---------- Project detail (#/projects/:id) ---------- */
async function mountDetail(outlet, repo, id, ctx) {
  const body = outlet.querySelector('#view-body');
  const h1 = outlet.querySelector('h1');
  const intro = outlet.querySelector('#view-intro');

  async function draw(focus) {
    const project = await repo.projects.get(id);
    if (!ctx.current()) return;
    body.removeAttribute('aria-busy');
    if (!project) {
      h1.textContent = 'Project not found';
      document.title = 'Project not found · SE Research Hub';
      body.innerHTML = '<div class="card empty-state"><p>That project does not exist. It may have been deleted.</p><a class="btn btn--secondary" href="#/projects">Back to projects</a></div>';
      return;
    }
    const questions = await repo.questions.listByProject(id);
    h1.textContent = project.name;
    document.title = `${project.name} · SE Research Hub`;
    intro.textContent = `Created ${date(project.createdAt)} · ${plural(questions.length, 'research question')}`;

    body.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="#/projects">Projects</a></li><li aria-current="page">${esc(project.name)}</li></ol></nav>

      <div class="two-col">
        <section aria-labelledby="rq-h">
          <h2 id="rq-h" tabindex="-1">Research questions</h2>
          ${questions.length ? `<ol class="rq-list">${questions.map((q, i) => `
            <li class="card rq" data-id="${esc(q.id)}">
              <div class="rq__row">
                <span class="badge rq__num">RQ${i + 1}</span>
                <p class="rq__text">${esc(q.text)}</p>
              </div>
              <div class="actions">
                <button type="button" class="btn btn--secondary btn--small" data-action="edit" data-id="${esc(q.id)}">Edit<span class="visually-hidden"> RQ${i + 1}</span></button>
                <button type="button" class="btn btn--danger-outline btn--small" data-action="delete" data-id="${esc(q.id)}">Delete<span class="visually-hidden"> RQ${i + 1}</span></button>
              </div>
            </li>`).join('')}</ol>` : '<p class="card empty-state">No research questions yet. Add the first one below.</p>'}

          <form id="add-rq" class="card form">
            <h3>Add a research question</h3>
            ${field({ id: 'rq-new', label: 'Research question', hint: `Ask one answerable question (${LIMITS.question.min} to ${LIMITS.question.max} characters). Example: “Does AI code generation improve developer productivity?”`, control: 'textarea', rows: 3, required: true, minlength: LIMITS.question.min, maxlength: LIMITS.question.max, counter: true })}
            <p class="form-status" role="alert"></p>
            <button type="submit" class="btn btn--primary">Add question</button>
          </form>
        </section>

        <div class="stack">
          <section class="card" aria-labelledby="det-h">
            <h2 id="det-h">Project details</h2>
            <form id="edit-project" class="form">
              ${projectFields('proj', project)}
              <p class="form-status" role="alert"></p>
              <button type="submit" class="btn btn--primary">Save details</button>
            </form>
          </section>
          <section class="card danger-zone" aria-labelledby="dz-h">
            <h2 id="dz-h">Delete project</h2>
            <p>Permanently removes this project, its research questions and any evidence recorded against them. This cannot be undone.</p>
            <button type="button" class="btn btn--danger" id="delete-project">Delete project</button>
          </section>
        </div>
      </div>`;

    wireForm(body.querySelector('#edit-project'), async (v) => {
      await repo.projects.update(id, { name: v['proj-name'], description: v['proj-description'] });
      showToast('Project details saved');
      await draw('#proj-name');
    });
    wireForm(body.querySelector('#add-rq'), async (v) => {
      await repo.questions.create(id, { text: v['rq-new'] });
      showToast('Research question added');
      await draw('#rq-new');
    });
    body.querySelector('#delete-project').addEventListener('click', async () => {
      const ok = await confirmAction({
        title: `Delete “${project.name}”?`,
        body: `This also deletes ${plural(questions.length, 'research question')} and any linked evidence. This cannot be undone.`,
        confirmLabel: 'Delete project',
      });
      if (!ok) return;
      await repo.projects.remove(id);
      showToast(`Project “${project.name}” deleted`);
      location.hash = '#/projects';
    });
    body.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => {
      const q = questions.find((x) => x.id === btn.dataset.id);
      const index = questions.indexOf(q) + 1;
      if (btn.dataset.action === 'edit') editQuestion(btn.closest('.rq'), q, index);
      else deleteQuestion(q, index);
    }));

    if (focus) body.querySelector(focus)?.focus();
  }

  function editQuestion(li, q, index) {
    li.innerHTML = `
      <form class="form" id="edit-rq">
        ${field({ id: `rq-edit-${q.id}`, label: `Research question RQ${index}`, hint: `${LIMITS.question.min} to ${LIMITS.question.max} characters.`, control: 'textarea', rows: 3, value: q.text, required: true, minlength: LIMITS.question.min, maxlength: LIMITS.question.max, counter: true })}
        <p class="form-status" role="alert"></p>
        <div class="actions">
          <button type="submit" class="btn btn--primary btn--small">Save</button>
          <button type="button" class="btn btn--secondary btn--small" id="cancel-edit">Cancel</button>
        </div>
      </form>`;
    const form = li.querySelector('form');
    form.querySelector('textarea').focus();
    wireForm(form, async (v) => {
      await repo.questions.update(q.id, { text: v[`rq-edit-${q.id}`] });
      showToast(`RQ${index} saved`);
      await draw(`[data-action="edit"][data-id="${q.id}"]`);
    });
    form.querySelector('#cancel-edit').addEventListener('click', () => draw(`[data-action="edit"][data-id="${q.id}"]`));
  }

  async function deleteQuestion(q, index) {
    const ok = await confirmAction({ title: `Delete RQ${index}?`, body: `“${q.text}” and any evidence recorded against it will be removed.`, confirmLabel: 'Delete question' });
    if (!ok) return;
    await repo.questions.remove(q.id);
    showToast(`RQ${index} deleted`);
    await draw('#rq-h');
  }

  await draw();
}

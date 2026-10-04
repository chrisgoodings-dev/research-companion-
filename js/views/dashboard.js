import { getRepo } from '../db/index.js';

const TILES = [
  ['projects', 'Research projects'],
  ['researchQuestions', 'Research questions'],
  ['papers', 'Saved papers'],
  ['evidenceNotes', 'Evidence records'],
];

export const dashboardRoute = {
  title: 'Dashboard',
  render: () => `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Your research evidence workspace: discover papers, capture what they report, and relate it to your research questions.</p>
    </div>
    <section aria-labelledby="stats-h">
      <h2 id="stats-h" class="visually-hidden">Workspace summary</h2>
      <ul class="card-grid" id="stats">${TILES.map(([k, label]) => `
        <li class="card stat"><span class="stat__value" data-stat="${k}">–</span><span class="stat__label">${label}</span></li>`).join('')}</ul>
    </section>
    <div class="two-col">
      <section class="card" aria-labelledby="start-h">
        <h2 id="start-h">Get started</h2>
        <ol class="steps">
          <li>Create a research project and add your research questions.</li>
          <li>Search for papers in <strong>Discover</strong>.</li>
          <li>Save relevant papers to your project.</li>
          <li>Record evidence and relate it to a question.</li>
          <li>Review the <strong>Matrix</strong> to see where the evidence agrees or conflicts.</li>
        </ol>
        <a class="btn btn--primary" href="#/projects">Go to Projects</a> <a class="btn btn--secondary" href="#/discover">Search papers</a>
      </section>
      <section class="card" aria-labelledby="status-h">
        <h2 id="status-h">Build status</h2>
        <p><span class="badge">Stage 4 of 12</span></p>
        <p>Projects, research questions and paper search (OpenAlex) are working. Saving papers to a project comes next.</p>
      </section>
    </div>`,
  async mount(outlet) {
    const counts = await (await getRepo()).counts();
    for (const [key] of TILES) outlet.querySelector(`[data-stat="${key}"]`).textContent = counts[key];
  },
};

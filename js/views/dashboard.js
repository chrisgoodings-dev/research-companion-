import { getRepo } from '../db/index.js';
import { lastBackup } from '../ui/download.js';
import { formatDate } from '../ui/format.js';

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
    <div id="view-body">
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
        <a class="btn btn--primary" href="#/projects">Go to Projects</a> <a class="btn btn--secondary" href="#/discover">Search papers</a> <a class="btn btn--secondary" href="#/matrix">Evidence matrix</a>
      </section>
      <section class="card" aria-labelledby="glance-h">
        <h2 id="glance-h">At a glance</h2>
        <ul class="steps steps--plain">
          <li><a href="#/matrix">Evidence matrix</a>: see where papers agree or conflict</li>
          <li><a href="#/progress">Progress</a>: what to read and record next</li>
          <li><a href="#/evidence">Evidence</a>: everything you have recorded</li>
        </ul>
        <p id="backup-note" class="review__saved"></p>
      </section>
    </div>
    </div>`,
  async mount(outlet) {
    const counts = await (await getRepo()).counts();
    const last = lastBackup();
    outlet.querySelector('#backup-note').innerHTML = last ? `Last backup: ${formatDate(last)}. <a href="#/backup">Back up now</a>` : 'No backup yet. <a href="#/backup">Back up your data</a>';
    for (const [key] of TILES) outlet.querySelector(`[data-stat="${key}"]`).textContent = counts[key];
  },
};

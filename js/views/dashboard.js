/** Dashboard. Counts are placeholders until IndexedDB lands in Stage 3. */
const stats = [
  { label: 'Research projects', value: 0 },
  { label: 'Research questions', value: 0 },
  { label: 'Saved papers', value: 0 },
  { label: 'Evidence records', value: 0 },
];

export function dashboardView() {
  const tiles = stats.map((s) => `
      <li class="card stat">
        <span class="stat__value">${s.value}</span>
        <span class="stat__label">${s.label}</span>
      </li>`).join('');

  return `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Your research evidence workspace: discover papers, capture what they report, and relate it to your research questions.</p>
    </div>

    <section aria-labelledby="stats-h">
      <h2 id="stats-h" class="visually-hidden">Workspace summary</h2>
      <ul class="card-grid">${tiles}</ul>
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
      </section>
      <section class="card" aria-labelledby="status-h">
        <h2 id="status-h">Build status</h2>
        <p><span class="badge">Stage 2 of 12</span></p>
        <p>App shell, navigation and routing are in place. Data storage comes next.</p>
        <a class="btn btn--primary" href="#/discover">Go to Discover</a>
      </section>
    </div>`;
}

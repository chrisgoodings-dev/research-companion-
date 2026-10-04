import { esc } from '../ui/dom.js';

/** Shared "coming in a later stage" view so every navigation item is reachable from day one. */
export function placeholderView({ title, summary, stage }) {
  return `
    <div class="page-header">
      <h1>${esc(title)}</h1>
      <p>${esc(summary)}</p>
    </div>
    <section class="card empty-state" aria-labelledby="ph-h">
      <h2 id="ph-h">Not built yet</h2>
      <p>This section is scheduled for <strong>${esc(stage)}</strong> of the build plan.</p>
      <a class="btn btn--secondary" href="#/dashboard">Back to dashboard</a>
    </section>`;
}

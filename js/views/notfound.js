import { esc } from '../ui/dom.js';

export const notFoundRoute = {
  title: 'Page not found',
  render: () => `
    <div class="page-header"><h1>Page not found</h1><p>That address does not match a page in SE Research Hub${location.hash ? `: <code>${esc(location.hash.slice(0, 80))}</code>` : ''}.</p></div>
    <div class="card empty-state">
      <h2>Where would you like to go?</h2>
      <div class="actions actions--center">
        <a class="btn btn--primary" href="#/dashboard">Dashboard</a>
        <a class="btn btn--secondary" href="#/projects">Projects</a>
        <a class="btn btn--secondary" href="#/discover">Discover papers</a>
      </div>
    </div>`,
};

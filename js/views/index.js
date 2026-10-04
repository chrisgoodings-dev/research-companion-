import { dashboardRoute } from './dashboard.js';
import { projectsRoute } from './projects.js';
import { discoverRoute } from './discover.js';
import { libraryRoute } from './library.js';
import { evidenceRoute } from './evidence.js';
import { placeholderView } from './placeholder.js';

export const routes = {
  dashboard: dashboardRoute,
  projects: projectsRoute,
  discover: discoverRoute,
  library: libraryRoute,
  evidence: evidenceRoute,
  matrix: { title: 'Matrix', render: () => placeholderView({ title: 'Evidence matrix', summary: 'Papers against research questions.', stage: 'Stage 8' }) },
  progress: { title: 'Progress', render: () => placeholderView({ title: 'Progress', summary: 'How far your review has got.', stage: 'Stage 10' }) },
  notFound: { title: 'Page not found', render: () => placeholderView({ title: 'Page not found', summary: 'That address does not match a page in the app.', stage: 'n/a' }) },
};

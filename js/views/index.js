import { dashboardRoute } from './dashboard.js';
import { projectsRoute } from './projects.js';
import { placeholderView } from './placeholder.js';

export const routes = {
  dashboard: dashboardRoute,
  projects: projectsRoute,
  discover: { title: 'Discover', render: () => placeholderView({ title: 'Discover', summary: 'Search scholarly APIs for papers.', stage: 'Stage 4' }) },
  library: { title: 'Library', render: () => placeholderView({ title: 'Library', summary: 'Papers you have saved to your projects.', stage: 'Stage 6' }) },
  evidence: { title: 'Evidence', render: () => placeholderView({ title: 'Evidence', summary: 'Evidence records linked to research questions.', stage: 'Stage 7' }) },
  matrix: { title: 'Matrix', render: () => placeholderView({ title: 'Evidence matrix', summary: 'Papers against research questions.', stage: 'Stage 8' }) },
  progress: { title: 'Progress', render: () => placeholderView({ title: 'Progress', summary: 'How far your review has got.', stage: 'Stage 10' }) },
  notFound: { title: 'Page not found', render: () => placeholderView({ title: 'Page not found', summary: 'That address does not match a page in the app.', stage: 'n/a' }) },
};

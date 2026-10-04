import { dashboardRoute } from './dashboard.js';
import { projectsRoute } from './projects.js';
import { discoverRoute } from './discover.js';
import { libraryRoute } from './library.js';
import { evidenceRoute } from './evidence.js';
import { matrixRoute } from './matrix.js';
import { backupRoute } from './backup.js';
import { progressRoute } from './progress.js';
import { notFoundRoute } from './notfound.js';

export const routes = {
  dashboard: dashboardRoute,
  projects: projectsRoute,
  discover: discoverRoute,
  library: libraryRoute,
  evidence: evidenceRoute,
  matrix: matrixRoute,
  progress: progressRoute,
  backup: backupRoute,
  notFound: notFoundRoute,
};

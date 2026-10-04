/** Route table. Each page is loaded with a dynamic import() the first time it is visited, so the browser
 *  downloads only the code for the page you open (code splitting without a bundler). The router accepts either
 *  a ready route ({ title, render, mount }) or a lazy one ({ title, load(attempt) }).
 *
 *  Browsers remember a FAILED module download for that exact URL, so a plain retry would fail again until the
 *  page is reloaded. Retries therefore add a throwaway query string (?retry=n), which makes the browser fetch it fresh. */
const lazy = (title, file, exportName) => ({
  title,
  load: (attempt = 0) => import(`./${file}${attempt ? `?retry=${attempt}` : ''}`).then((m) => m[exportName]),
});

export const routes = {
  dashboard: lazy('Dashboard', 'dashboard.js', 'dashboardRoute'),
  projects: lazy('Projects', 'projects.js', 'projectsRoute'),
  discover: lazy('Discover', 'discover.js', 'discoverRoute'),
  library: lazy('Library', 'library.js', 'libraryRoute'),
  evidence: lazy('Evidence', 'evidence.js', 'evidenceRoute'),
  matrix: lazy('Matrix', 'matrix.js', 'matrixRoute'),
  progress: lazy('Progress', 'progress.js', 'progressRoute'),
  backup: lazy('Backup & export', 'backup.js', 'backupRoute'),
  notFound: lazy('Page not found', 'notfound.js', 'notFoundRoute'),
};

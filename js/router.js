/** Minimal hash router. Hash routes work on any static host without rewrite rules. */

/** Turn "#/library" (or "", "#", "#/") into a route name. Pure, so it is unit-testable. */
export function parseHash(hash) {
  const cleaned = String(hash || '').replace(/^#\/?/, '').split(/[?/]/)[0].trim();
  return cleaned || 'dashboard';
}

/** Only "#", "#/" and "#/name" are routes. Other fragments (such as the skip link's "#main") are left alone. */
export function isRouteHash(hash) {
  const h = String(hash || '');
  return h === '' || h === '#' || h.startsWith('#/');
}

/** Return the route for a hash, falling back to the not-found route. */
export function resolveRoute(hash, routes) {
  const name = parseHash(hash);
  return { name, route: routes[name] ?? routes.notFound, found: name in routes };
}

import { announce } from './ui/announcer.js';

export function startRouter({ routes, outlet, onNavigate }) {
  let first = true;

  function show() {
    if (!first && !isRouteHash(location.hash)) return;
    const { name, route, found } = resolveRoute(location.hash, routes);
    outlet.innerHTML = route.render();
    document.title = `${route.title} · SE Research Hub`;

    document.querySelectorAll('.nav__link[href]').forEach((link) => {
      const active = link.getAttribute('href') === `#/${name}` && found;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // After a route change, move focus to the new page heading and announce it (WCAG 2.4.3, 4.1.3).
    // Skip on the very first load so we don't steal focus from the browser's own start position.
    if (!first) {
      const heading = outlet.querySelector('h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: false }); }
      announce(`${route.title} page`);
    }
    first = false;
    window.scrollTo(0, 0);
    onNavigate?.(name);
  }

  window.addEventListener('hashchange', show);
  show();
}

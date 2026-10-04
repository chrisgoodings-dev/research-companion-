/** Minimal hash router. Hash routes work on any static host without rewrite rules.
 *  Route shape: { title, render(params) -> html | Promise<html>, mount?(outlet, params, ctx) } */
import { announce } from './ui/announcer.js';
import { esc } from './ui/dom.js';

/** Split "#/projects/abc?x=1" into { name: 'projects', params: ['abc'] }. Pure, so it is unit-testable. */
export function parseRoute(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return { name: parts[0] || 'dashboard', params: parts.slice(1) };
}

/** Read "?q=ai&from=2020" from the hash (the part after the first "?"). */
export function parseQuery(hash) {
  const i = String(hash || '').indexOf('?');
  return new URLSearchParams(i === -1 ? '' : String(hash).slice(i + 1));
}

export const parseHash = (hash) => parseRoute(hash).name;

/** Only "#", "#/" and "#/name" are routes. Other fragments (such as the skip link's "#main") are left alone. */
export function isRouteHash(hash) {
  const h = String(hash || '');
  return h === '' || h === '#' || h.startsWith('#/');
}

/** Return the route for a hash, falling back to the not-found route. */
export function resolveRoute(hash, routes) {
  const { name, params } = parseRoute(hash);
  const found = name !== 'notFound' && Object.hasOwn(routes, name);
  return { name, params, route: found ? routes[name] : routes.notFound, found };
}

export function startRouter({ routes, outlet }) {
  let first = true;
  let navigation = 0; // guards against a slow view overwriting a newer one

  async function show() {
    if (!first && !isRouteHash(location.hash)) return;
    const isFirst = first;
    first = false;
    const token = ++navigation;
    const { name, params, route, found } = resolveRoute(location.hash, routes);
    const current = () => token === navigation;

    let html;
    try { html = await route.render(params); }
    catch (err) { console.error(err); html = `<h1>Something went wrong</h1><p role="alert">${esc(err.message)}</p>`; }
    if (!current()) return;

    outlet.innerHTML = html;
    document.title = `${route.title} · SE Research Hub`;
    document.querySelectorAll('.nav__link[href]').forEach((link) => {
      if (found && link.getAttribute('href') === `#/${name}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // After a route change, move focus to the new page heading and announce it (WCAG 2.4.3, 4.1.3).
    // Skipped on first load so we don't steal focus from the browser's own start position.
    if (!isFirst) {
      const heading = outlet.querySelector('h1');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
      announce(`${route.title} page`);
    }
    window.scrollTo(0, 0);

    try { await route.mount?.(outlet, params, { current }); }
    catch (err) {
      console.error(err);
      const body = outlet.querySelector('#view-body') ?? outlet;
      body.removeAttribute('aria-busy');
      body.innerHTML = `<div class="card" role="alert"><h2>This section could not load</h2><p>${esc(err.message)}</p><p>Your browser may be blocking local storage (for example in a private window).</p></div>`;
    }
  }

  window.addEventListener('hashchange', show);
  return show();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, resolveRoute, isRouteHash } from '../../js/router.js';

// router.js imports the announcer, which only touches `document` when called, so it loads in Node.

test('parseHash defaults to dashboard', () => {
  for (const h of ['', '#', '#/', undefined, null]) assert.equal(parseHash(h), 'dashboard');
});

test('parseHash extracts the first path segment', () => {
  assert.equal(parseHash('#/library'), 'library');
  assert.equal(parseHash('#/library/42'), 'library');
  assert.equal(parseHash('#/discover?q=ai'), 'discover');
});

test('resolveRoute falls back to notFound for unknown names', () => {
  const routes = { dashboard: { title: 'D' }, notFound: { title: 'NF' } };
  assert.equal(resolveRoute('#/nope', routes).route.title, 'NF');
  assert.equal(resolveRoute('#/nope', routes).found, false);
  assert.equal(resolveRoute('#/dashboard', routes).found, true);
});

test('isRouteHash ignores in-page fragments like the skip link', () => {
  assert.equal(isRouteHash('#main'), false);
  for (const h of ['', '#', '#/', '#/library']) assert.equal(isRouteHash(h), true);
});

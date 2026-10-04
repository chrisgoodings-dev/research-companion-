import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, parseHash, parseRoute, resolveRoute, isRouteHash } from '../../js/router.js';

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

test('parseRoute returns params and decodes them safely', () => {
  assert.deepEqual(parseRoute('#/projects/abc-123'), { name: 'projects', params: ['abc-123'] });
  assert.deepEqual(parseRoute('#/projects/a%20b?x=1'), { name: 'projects', params: ['a b'] });
  assert.deepEqual(parseRoute('#/projects/%E0%A4%A'), { name: 'projects', params: ['%E0%A4%A'] }); // malformed escape does not throw
});

test('resolveRoute does not match inherited object keys', () => {
  const routes = { dashboard: {}, notFound: { title: 'NF' } };
  assert.equal(resolveRoute('#/constructor', routes).found, false);
  assert.equal(resolveRoute('#/__proto__', routes).found, false);
  assert.equal(resolveRoute('#/notFound', routes).found, false);
});

test('parseQuery reads the query string from a hash', () => {
  const p = parseQuery('#/discover?q=ai%20code&from=2020&oa=1');
  assert.equal(p.get('q'), 'ai code');
  assert.equal(p.get('from'), '2020');
  assert.equal(p.get('oa'), '1');
  assert.equal(parseQuery('#/discover').get('q'), null);
  assert.equal(parseQuery('').toString(), '');
});

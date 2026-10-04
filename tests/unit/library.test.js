import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPapers } from '../../js/library.js';

const mk = (id, title, extra = {}) => ({ id, title, authors: ['Ada Lovelace'], venue: 'Journal of Tests', year: 2020, doi: '', citedBy: 0, links: [{ projectId: 'p1', status: 'unread', addedAt: '2026-01-01T00:00:00Z' }], ...extra });
const items = [
  mk('a', 'Neural code completion', { year: 2022, citedBy: 200, authors: ['Albert Ziegler'], links: [{ projectId: 'p1', status: 'read', addedAt: '2026-03-01T00:00:00Z' }] }),
  mk('b', 'Copilot pair programming', { year: 2023, citedBy: 80, links: [{ projectId: 'p2', status: 'reading', addedAt: '2026-02-01T00:00:00Z' }, { projectId: 'p1', status: 'unread', addedAt: '2026-01-15T00:00:00Z' }] }),
  mk('c', 'a survey of LLMs', { year: null, citedBy: 5, doi: '10.1000/xyz' }),
];
const ids = (r) => r.map((p) => p.id);

test('default: everything, most recently saved first', () => {
  assert.deepEqual(ids(filterPapers(items)), ['a', 'b', 'c']);
});

test('text search is case-insensitive, matches title/author/venue/doi/year and requires every word', () => {
  assert.deepEqual(ids(filterPapers(items, { q: 'COPILOT' })), ['b']);
  assert.deepEqual(ids(filterPapers(items, { q: 'ziegler' })), ['a']);
  assert.deepEqual(ids(filterPapers(items, { q: 'xyz' })), ['c']);
  assert.deepEqual(ids(filterPapers(items, { q: '2023' })), ['b']);
  assert.deepEqual(ids(filterPapers(items, { q: 'neural survey' })), []);
  assert.deepEqual(ids(filterPapers(items, { q: '   ' })), ['a', 'b', 'c']);
});

test('project filter keeps papers saved in that project', () => {
  assert.deepEqual(ids(filterPapers(items, { project: 'p2' })), ['b']);
  assert.deepEqual(ids(filterPapers(items, { project: 'p1' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filterPapers(items, { project: 'nope' })), []);
});

test('status filter respects the chosen project', () => {
  assert.deepEqual(ids(filterPapers(items, { status: 'read' })), ['a']);
  assert.deepEqual(ids(filterPapers(items, { status: 'reading' })), ['b']);
  assert.deepEqual(ids(filterPapers(items, { project: 'p1', status: 'reading' })), [], "b is 'reading' only in p2");
  assert.deepEqual(ids(filterPapers(items, { project: 'p1', status: 'unread' })), ['b', 'c']);
});

test('sorting', () => {
  assert.deepEqual(ids(filterPapers(items, { sort: 'year' })), ['b', 'a', 'c'], 'unknown year last');
  assert.deepEqual(ids(filterPapers(items, { sort: 'cited' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filterPapers(items, { sort: 'title' })), ['b', 'a', 'c'].sort((x, y) => items.find((i) => i.id === x).title.localeCompare(items.find((i) => i.id === y).title, 'en', { sensitivity: 'base' })));
  assert.deepEqual(ids(filterPapers(items, { sort: 'bogus' })), ['a', 'b', 'c'], 'unknown sort falls back to saved');
});

test('does not mutate its input', () => {
  const copy = items.map((i) => i.id);
  filterPapers(items, { sort: 'title' });
  assert.deepEqual(items.map((i) => i.id), copy);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, validateQuestion, assertValid, ValidationError } from '../../js/validation.js';

test('project: trims and accepts a valid name', () => {
  const r = validateProject({ name: '  AI code study  ', description: ' x ' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.values, { name: 'AI code study', description: 'x' });
});

test('project: rejects short, whitespace-only and over-long input', () => {
  assert.equal(validateProject({ name: 'ab' }).errors.name.includes('at least 3'), true);
  assert.equal(validateProject({ name: '     ' }).valid, false);
  assert.equal(validateProject({ name: 'a'.repeat(81) }).valid, false);
  assert.equal(validateProject({ name: 'ok name', description: 'd'.repeat(501) }).errors.description.includes('500'), true);
});

test('project: tolerates missing or non-string input', () => {
  assert.equal(validateProject().valid, false);
  assert.equal(validateProject({ name: 42 }).valid, false);
});

test('question: length bounds', () => {
  assert.equal(validateQuestion({ text: 'Too short' }).valid, false);
  assert.equal(validateQuestion({ text: 'Does AI assistance improve productivity?' }).valid, true);
  assert.equal(validateQuestion({ text: 'q'.repeat(301) }).valid, false);
});

test('assertValid throws ValidationError with field errors', () => {
  assert.throws(() => assertValid(validateProject({ name: '' })), (e) => e instanceof ValidationError && 'name' in e.errors);
});

import { validatePaper } from '../../js/validation.js';

test('paper: whitelists fields and coerces types', () => {
  const r = validatePaper({ id: 'doi:10.1/a', title: '  A paper ', doi: '10.1/A', authors: ['A', '', 5, 'B'], year: 2020, url: 'https://x.org', evil: '<script>', isOa: 'yes', citedBy: -4, oaStatus: 'weird' });
  assert.equal(r.valid, true);
  assert.equal(r.values.title, 'A paper');
  assert.deepEqual(r.values.authors, ['A', 'B']);
  assert.equal(r.values.isOa, false, 'only literal true counts');
  assert.equal(r.values.citedBy, 0);
  assert.equal(r.values.oaStatus, 'unknown');
  assert.equal('evil' in r.values, false, 'unknown fields are dropped');
});

test('paper: rejects missing id/title and unsafe URLs are blanked', () => {
  assert.equal(validatePaper({ id: '', title: 'x' }).valid, false);
  assert.equal(validatePaper({ id: 'a', title: '   ' }).valid, false);
  assert.equal(validatePaper({ id: 'a', title: 'x', url: 'javascript:alert(1)', oaUrl: 'data:text/html,x' }).values.url, '');
  assert.equal(validatePaper().valid, false);
});

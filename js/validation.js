import { safeUrl } from './api/paper.js';

/** Data-layer validation. The forms validate for the user's benefit; this guards what reaches
 *  IndexedDB (and, later, anything imported from a JSON backup). Pure, so it is unit-tested. */
export const LIMITS = {
  projectName: { min: 3, max: 80 },
  projectDescription: { max: 500 },
  question: { min: 10, max: 300 },
};

export class ValidationError extends Error {
  constructor(errors) {
    super(`Validation failed: ${Object.values(errors).join(' ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateProject(input = {}) {
  const name = str(input.name);
  const description = str(input.description);
  const errors = {};
  if (name.length < LIMITS.projectName.min) errors.name = `Project name must be at least ${LIMITS.projectName.min} characters.`;
  else if (name.length > LIMITS.projectName.max) errors.name = `Project name must be at most ${LIMITS.projectName.max} characters.`;
  if (description.length > LIMITS.projectDescription.max) errors.description = `Description must be at most ${LIMITS.projectDescription.max} characters.`;
  return { valid: Object.keys(errors).length === 0, errors, values: { name, description } };
}

export function validateQuestion(input = {}) {
  const text = str(input.text);
  const errors = {};
  if (text.length < LIMITS.question.min) errors.text = `A research question must be at least ${LIMITS.question.min} characters.`;
  else if (text.length > LIMITS.question.max) errors.text = `A research question must be at most ${LIMITS.question.max} characters.`;
  return { valid: Object.keys(errors).length === 0, errors, values: { text } };
}

export function assertValid(result) {
  if (!result.valid) throw new ValidationError(result.errors);
  return result.values;
}

const OA_STATUSES = ['gold', 'green', 'hybrid', 'bronze', 'diamond', 'closed', 'unknown', 'open'];

/** Whitelist and coerce every field of a paper before it is stored. This is also what a JSON import
 *  will go through, so a hand-edited or hostile backup file cannot put unexpected data in the database. */
export function validatePaper(input = {}) {
  const errors = {};
  const id = str(input.id);
  const title = str(input.title).slice(0, 1000);
  if (!id || id.length > 300) errors.id = 'A paper needs an id.';
  if (!title) errors.title = 'A paper needs a title.';
  const list = (v, max, len) => (Array.isArray(v) ? v.map((x) => str(x).slice(0, len)).filter(Boolean).slice(0, max) : []);
  const int = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);
  const values = {
    id,
    title,
    doi: str(input.doi).toLowerCase().slice(0, 200),
    authors: list(input.authors, 200, 200),
    year: Number.isInteger(input.year) && input.year > 1000 && input.year < 3000 ? input.year : null,
    venue: str(input.venue).slice(0, 500),
    abstract: str(input.abstract).slice(0, 20000),
    url: safeUrl(input.url),
    oaUrl: safeUrl(input.oaUrl),
    isOa: input.isOa === true,
    oaStatus: OA_STATUSES.includes(input.oaStatus) ? input.oaStatus : 'unknown',
    citedBy: int(input.citedBy),
    type: str(input.type).slice(0, 60),
    source: str(input.source).slice(0, 40),
    sources: list(input.sources, 5, 40),
    sourceId: str(input.sourceId).slice(0, 300),
  };
  return { valid: Object.keys(errors).length === 0, errors, values };
}

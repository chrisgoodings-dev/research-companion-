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

export const REVIEW_STATUSES = ['unread', 'reading', 'read'];
export const REVIEW_FIELDS = ['studyAim', 'methodology', 'participants', 'keyFindings', 'limitations', 'notes'];
export const REVIEW_MAX = 2000;

/** A structured review of one paper within one project. Every text field is optional; status is required. */
export function validateReview(input = {}) {
  const errors = {};
  const status = REVIEW_STATUSES.includes(input.status) ? input.status : null;
  if (!status) errors.status = 'Choose a reading status.';
  const values = { status: status ?? 'unread' };
  for (const key of REVIEW_FIELDS) {
    const text = str(input[key]);
    if (text.length > REVIEW_MAX) errors[key] = `Must be at most ${REVIEW_MAX} characters.`;
    values[key] = text;
  }
  return { valid: Object.keys(errors).length === 0, errors, values };
}

export const RELATIONSHIPS = ['supports', 'contradicts', 'mixed', 'contextual', 'none'];
export const EVIDENCE_LIMITS = { evidence: { max: 3000 }, interpretation: { max: 3000 }, location: { max: 100 }, tags: { max: 10, length: 40 } };

/** "Productivity, controlled  Experiment, productivity" -> ['productivity', 'controlled experiment'] */
export function parseTags(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const tags = [];
  for (const item of raw) {
    const tag = String(item).toLowerCase().replace(/\s+/g, ' ').trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Message for a bad tag list, or '' (shared by the form and the data layer). */
export function tagsError(value) {
  const tags = parseTags(value);
  if (tags.length > EVIDENCE_LIMITS.tags.max) return `Use at most ${EVIDENCE_LIMITS.tags.max} tags (you have ${tags.length}).`;
  const long = tags.find((t) => t.length > EVIDENCE_LIMITS.tags.length);
  return long ? `Each tag must be at most ${EVIDENCE_LIMITS.tags.length} characters ("${long.slice(0, 20)}…" is too long).` : '';
}

/** One piece of evidence: what a paper reports (evidence) kept apart from what the researcher makes of it
 *  (interpretation), tied to one research question with a relationship. */
export function validateEvidence(input = {}) {
  const errors = {};
  const evidence = str(input.evidence);
  const interpretation = str(input.interpretation);
  const location = str(input.location);
  const relationship = RELATIONSHIPS.includes(input.relationship) ? input.relationship : null;
  const ids = { projectId: str(input.projectId), paperId: str(input.paperId), researchQuestionId: str(input.researchQuestionId) };

  if (!ids.researchQuestionId) errors.researchQuestionId = 'Choose a research question.';
  if (!ids.projectId || !ids.paperId) errors.paperId = 'Evidence must belong to a paper in a project.';
  if (!relationship) errors.relationship = 'Choose how this evidence relates to the question.';
  if (!evidence) errors.evidence = 'Describe what the paper reports.';
  else if (evidence.length > EVIDENCE_LIMITS.evidence.max) errors.evidence = `Evidence must be at most ${EVIDENCE_LIMITS.evidence.max} characters.`;
  if (interpretation.length > EVIDENCE_LIMITS.interpretation.max) errors.interpretation = `Interpretation must be at most ${EVIDENCE_LIMITS.interpretation.max} characters.`;
  if (location.length > EVIDENCE_LIMITS.location.max) errors.location = `Location must be at most ${EVIDENCE_LIMITS.location.max} characters.`;
  const tagProblem = tagsError(input.tags);
  if (tagProblem) errors.tags = tagProblem;

  return { valid: Object.keys(errors).length === 0, errors, values: { ...ids, relationship: relationship ?? 'none', evidence, interpretation, location, tags: parseTags(input.tags) } };
}

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

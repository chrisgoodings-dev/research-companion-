import { announce } from './announcer.js';

/** Plain-language message for an invalid control, or '' if it is fine. We compute lengths on the
 *  trimmed value so "   " cannot satisfy `required`, which native validation would allow. */
export function messageFor(input) {
  const label = input.dataset.label || 'This field';
  const trimmed = input.value.trim();
  if (input.required && trimmed === '') return input.tagName === 'SELECT' ? `Choose ${label.toLowerCase()}.` : `Enter ${label.toLowerCase()}.`;
  const min = Number(input.getAttribute('minlength')) || 0;
  if (trimmed !== '' && min && trimmed.length < min) return `${label} must be at least ${min} characters (you have ${trimmed.length}).`;
  const max = Number(input.getAttribute('maxlength')) || 0;
  if (max && input.value.length > max) return `${label} must be at most ${max} characters.`;
  if (input.type === 'number') {
    if (input.validity.badInput || input.validity.stepMismatch) return `${label} must be a whole number.`;
    if (input.validity.rangeUnderflow) return `${label} must be ${input.min} or later.`;
    if (input.validity.rangeOverflow) return `${label} must be ${input.max} or earlier.`;
  }
  if (input.type === 'url' && trimmed !== '' && !input.validity.valid) return `${label} must be a full web address starting with http:// or https://.`;
  return '';
}

function setState(input, message) {
  const error = document.getElementById(`${input.id}-error`);
  const hint = `${input.id}-hint`;
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${hint} ${input.id}-error`);
    if (error) { error.textContent = message; error.hidden = false; }
  } else {
    input.removeAttribute('aria-invalid');
    input.setAttribute('aria-describedby', hint);
    if (error) { error.textContent = ''; error.hidden = true; }
  }
}

const controls = (form) => [...form.querySelectorAll('input:not([type=hidden]), textarea, select')];

/** Validate every control, show messages, and return the invalid ones. */
export function validateForm(form, crossChecks = []) {
  const invalid = [];
  const cross = new Map();
  // Cross-field rules (for example "from year <= to year") return [{ input, message }].
  for (const check of crossChecks) for (const { input, message } of check(form)) cross.set(input, message);
  for (const input of controls(form)) {
    const message = messageFor(input) || cross.get(input) || '';
    setState(input, message);
    if (message) invalid.push(input);
  }
  return invalid;
}

/** Attach submit handling: custom validation, focus on the first problem, announcements,
 *  double-submit protection and live character counters. */
export function wireForm(form, onSubmit, { crossChecks = [] } = {}) {
  form.noValidate = true; // we show our own, accessible messages instead of browser bubbles

  const updateCounters = () => form.querySelectorAll('[data-counter-for]').forEach((el) => {
    const input = document.getElementById(el.dataset.counterFor);
    el.textContent = `${input.value.length} / ${input.getAttribute('maxlength')}`;
  });
  updateCounters();

  form.addEventListener('input', (e) => {
    updateCounters();
    // Once a field has been flagged, re-check it as the user types so the message clears when fixed.
    if (e.target.getAttribute?.('aria-invalid') === 'true') validateForm(form, crossChecks);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.busy) return;
    const invalid = validateForm(form, crossChecks);
    if (invalid.length) {
      invalid[0].focus();
      announce(`${invalid.length === 1 ? '1 field needs' : `${invalid.length} fields need`} attention. ${document.getElementById(`${invalid[0].id}-error`)?.textContent ?? ''}`);
      return;
    }
    form.dataset.busy = '1';
    const buttons = form.querySelectorAll('button[type=submit]');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const data = new FormData(form);
      await onSubmit(Object.fromEntries(data), data);
    } catch (err) {
      console.error(err);
      announce(`Could not save: ${err.message}`);
      form.querySelector('.form-status')?.replaceChildren(`Could not save: ${err.message}`);
    } finally {
      delete form.dataset.busy;
      buttons.forEach((b) => { b.disabled = false; });
    }
  });
}

const fields = (root) => [...root.querySelectorAll('input:not([type=hidden]):not([type=button]):not([type=submit]), textarea, select')];

/** True if any field differs from the value it had when rendered (so typing then deleting is NOT dirty). */
export function isDirty(root) {
  return fields(root).some((el) => {
    if (el.tagName === 'SELECT') {
      // With no `selected` attribute the browser preselects the first option, so that is the baseline.
      const preset = [...el.options].findIndex((o) => o.defaultSelected);
      return el.selectedIndex !== (preset === -1 ? 0 : preset);
    }
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
    return el.value !== el.defaultValue;
  });
}

/** Treat the current values as the saved baseline (call after a successful save). */
export function markClean(root) {
  for (const el of fields(root)) {
    if (el.tagName === 'SELECT') [...el.options].forEach((o, i) => { o.defaultSelected = i === el.selectedIndex; });
    else if (el.type === 'checkbox' || el.type === 'radio') el.defaultChecked = el.checked;
    else el.defaultValue = el.value;
  }
}

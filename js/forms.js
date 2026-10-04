// Form validation: the browser's built-in rules (required, minlength, min, max, type)
// plus clear messages shown in the page, linked to the field with aria-describedby.

function labelOf(control) {
  return control.labels?.[0]?.textContent.trim() ?? 'This field';
}

function messageFor(control) {
  const v = control.validity;
  if (v.customError) return control.validationMessage;
  if (v.valueMissing) return control.type === 'radio' ? 'Choose one option.' : `${labelOf(control)} is required.`;
  if (v.tooShort) return `${labelOf(control)} must be at least ${control.minLength} characters.`;
  if (v.rangeUnderflow || v.rangeOverflow) return `Enter a year between ${control.min} and ${control.max}.`;
  if (v.badInput || v.typeMismatch) return `${labelOf(control)} must be a valid value.`;
  return control.validationMessage;
}

/** Radio buttons are described as a group: the message belongs to their fieldset. */
const holderOf = (control) => (control.type === 'radio' ? control.closest('fieldset') : control);

function errorElement(holder) {
  const id = `${holder.id || holder.name}-error`;
  let p = document.getElementById(id);
  if (!p) {
    p = document.createElement('p');
    p.id = id;
    p.className = 'error';
    holder.after(p); // sits straight after the field
  }
  return p;
}

function showError(control, message) {
  const holder = holderOf(control);
  const p = errorElement(holder);
  p.textContent = message;
  holder.setAttribute('aria-invalid', 'true');
  const ids = (holder.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  if (!ids.includes(p.id)) holder.setAttribute('aria-describedby', [...ids, p.id].join(' '));
}

function clearError(control) {
  const holder = holderOf(control);
  holder.removeAttribute('aria-invalid');
  const p = document.getElementById(`${holder.id || holder.name}-error`);
  if (p) {
    const ids = (holder.getAttribute('aria-describedby') ?? '').split(' ').filter((i) => i && i !== p.id);
    if (ids.length) holder.setAttribute('aria-describedby', ids.join(' '));
    else holder.removeAttribute('aria-describedby');
    p.remove();
  }
}

function check(control) {
  // Whitespace-only text should count as empty, which the built-in "required" rule does not do.
  if (control.required && control.type !== 'radio' && /^(text|search|textarea)/.test(control.type)) {
    control.setCustomValidity(control.value.trim() ? '' : `${labelOf(control)} is required.`);
  }
  if (control.checkValidity()) { clearError(control); return true; }
  showError(control, messageFor(control));
  return false;
}

/** Validate every field. Returns true if the form is valid; otherwise shows the errors,
 *  moves focus to the first problem and returns false. */
export function validateForm(form) {
  const bad = [];
  for (const control of form.elements) {
    if (!control.willValidate || control.type === 'submit' || control.type === 'button') continue;
    if (!check(control)) bad.push(control);
  }
  if (bad.length) bad[0].focus();
  return { valid: bad.length === 0, count: bad.length };
}

/** After the first failed submit, re-check a field as the user corrects it. */
export function liveValidate(form) {
  const recheck = (event) => {
    const control = event.target;
    if (holderOf(control)?.getAttribute('aria-invalid') === 'true') check(control);
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);
}

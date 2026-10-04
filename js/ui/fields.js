import { esc } from './dom.js';

/** Render one labelled form field. Every control gets a real <label>, a hint and an (initially hidden)
 *  error message wired up through aria-describedby (WCAG 1.3.1, 3.3.1, 3.3.2). */
export function field({ id, label, hint = '', control = 'input', type = 'text', value = '', required = false, minlength, maxlength, rows = 4, autocomplete = 'off', counter = false, min, max, step, inputmode, enterkeyhint, optionalTag = true }) {
  const attrs = [
    `id="${id}"`, `name="${id}"`, `data-label="${esc(label)}"`, `aria-describedby="${id}-hint"`,
    required ? 'required' : '',
    minlength ? `minlength="${minlength}"` : '',
    maxlength ? `maxlength="${maxlength}"` : '',
    `autocomplete="${autocomplete}"`,
    min !== undefined ? `min="${min}"` : '',
    max !== undefined ? `max="${max}"` : '',
    step !== undefined ? `step="${step}"` : '',
    inputmode ? `inputmode="${inputmode}"` : '',
    enterkeyhint ? `enterkeyhint="${enterkeyhint}"` : '',
  ].filter(Boolean).join(' ');

  const input = control === 'textarea'
    ? `<textarea ${attrs} rows="${rows}">${esc(value)}</textarea>`
    : `<input type="${type}" ${attrs} value="${esc(value)}">`;

  return `
    <div class="field">
      <label class="field__label" for="${id}">${esc(label)}${required ? ' <span class="field__req">(required)</span>' : (optionalTag ? ' <span class="field__req">(optional)</span>' : '')}</label>
      <p class="field__hint" id="${id}-hint">${esc(hint)}</p>
      ${input}
      <p class="field__error" id="${id}-error" hidden></p>
      ${counter && maxlength ? `<p class="field__counter" data-counter-for="${id}" aria-hidden="true">0 / ${maxlength}</p>` : ''}
    </div>`;
}

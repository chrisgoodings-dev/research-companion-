import { esc } from './dom.js';

/** Render one labelled form field. Every control gets a real <label>, a hint and an (initially hidden)
 *  error message wired up through aria-describedby (WCAG 1.3.1, 3.3.1, 3.3.2). */
export function field({ id, label, hint = '', control = 'input', type = 'text', value = '', required = false, minlength, maxlength, rows = 4, autocomplete = 'off', counter = false }) {
  const attrs = [
    `id="${id}"`, `name="${id}"`, `data-label="${esc(label)}"`, `aria-describedby="${id}-hint"`,
    required ? 'required' : '',
    minlength ? `minlength="${minlength}"` : '',
    maxlength ? `maxlength="${maxlength}"` : '',
    `autocomplete="${autocomplete}"`,
  ].filter(Boolean).join(' ');

  const input = control === 'textarea'
    ? `<textarea ${attrs} rows="${rows}">${esc(value)}</textarea>`
    : `<input type="${type}" ${attrs} value="${esc(value)}">`;

  return `
    <div class="field">
      <label class="field__label" for="${id}">${esc(label)} <span class="field__req">${required ? '(required)' : '(optional)'}</span></label>
      <p class="field__hint" id="${id}-hint">${esc(hint)}</p>
      ${input}
      <p class="field__error" id="${id}-error" hidden></p>
      ${counter && maxlength ? `<p class="field__counter" data-counter-for="${id}" aria-hidden="true">0 / ${maxlength}</p>` : ''}
    </div>`;
}

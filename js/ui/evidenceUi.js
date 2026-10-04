import { esc } from './dom.js';
import { field } from './fields.js';
import { RELATIONSHIPS, EVIDENCE_LIMITS, tagsError } from '../validation.js';
import { REL_LABEL, REL_HELP, REL_SYMBOL, formatDate } from './format.js';

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const relBadge = (rel) =>
  `<span class="rel rel--${esc(rel)}"><span class="rel__icon" aria-hidden="true">${REL_SYMBOL[rel] ?? ''}</span>${esc(REL_LABEL[rel] ?? rel)}</span>`;

/** One evidence record. What the paper reports and the researcher's interpretation are separate,
 *  labelled blocks (a description list, so assistive tech announces term and definition). */
export function evidenceCard(e, { rqLabel, rqText, paperHtml = '', actionsHtml = '' }) {
  return `
    <li class="card ev" data-id="${esc(e.id)}">
      <div class="ev__head"><span class="badge">${esc(rqLabel)}</span>${relBadge(e.relationship)}<span class="ev__date">${formatDate(e.createdAt)}</span></div>
      <p class="ev__rq">${esc(rqText)}</p>
      ${paperHtml}
      <dl class="ev__blocks">
        <div class="ev__block"><dt>From the paper</dt><dd>${esc(e.evidence)}</dd></div>
        ${e.interpretation ? `<div class="ev__block ev__block--mine"><dt>Your interpretation</dt><dd>${esc(e.interpretation)}</dd></div>` : ''}
        ${e.location ? `<div class="ev__block ev__block--where"><dt>Where</dt><dd>${esc(e.location)}</dd></div>` : ''}
      </dl>
      ${e.tags.length ? `<ul class="chips" aria-label="Tags">${e.tags.map((t) => `<li class="chip">${esc(t)}</li>`).join('')}</ul>` : ''}
      ${actionsHtml}
    </li>`;
}

/** The add/edit form. `prefix` keeps ids unique when several forms are on the page. */
export function evidenceForm(prefix, { record = {}, questions, submitLabel }) {
  const rqOptions = `<option value="">Choose a research question</option>${questions.map((q, i) =>
    `<option value="${esc(q.id)}"${q.id === record.researchQuestionId ? ' selected' : ''}>RQ${i + 1}: ${esc(truncate(q.text, 90))}</option>`).join('')}`;

  const radios = RELATIONSHIPS.map((r, i) => `
      <div class="radio radio--block">
        <input type="radio" id="${prefix}-rel-${r}" name="${prefix}-rel" value="${r}"${r === record.relationship ? ' checked' : ''}${i === 0 ? ` aria-describedby="${prefix}-rel-supports-hint ${prefix}-rel-supports-error"` : ''}>
        <label for="${prefix}-rel-${r}"><span class="radio__name"><span aria-hidden="true">${REL_SYMBOL[r]}</span> ${REL_LABEL[r]}</span> <span class="radio__desc">${REL_HELP[r]}</span></label>
      </div>`).join('');

  return `
    <div class="field">
      <label class="field__label" for="${prefix}-rq">Research question <span class="field__req">(required)</span></label>
      <p class="field__hint" id="${prefix}-rq-hint">Which question does this evidence help answer?</p>
      <select id="${prefix}-rq" name="${prefix}-rq" required data-label="Research question" aria-describedby="${prefix}-rq-hint">${rqOptions}</select>
      <p class="field__error" id="${prefix}-rq-error" hidden></p>
    </div>
    <fieldset class="radio-group radio-group--stack">
      <legend>Relationship to the question <span class="field__req">(required)</span></legend>
      <p class="field__hint" id="${prefix}-rel-supports-hint">Choose the one that best describes what this paper says about the question.</p>
      ${radios}
      <p class="field__error" id="${prefix}-rel-supports-error" hidden></p>
    </fieldset>
    ${field({ id: `${prefix}-evidence`, label: 'Evidence from the paper', hint: 'What the paper reports: findings, numbers or a short quotation. Keep your own opinion out of this box.', control: 'textarea', rows: 4, value: record.evidence ?? '', required: true, maxlength: EVIDENCE_LIMITS.evidence.max, counter: true })}
    ${field({ id: `${prefix}-interpretation`, label: 'Your interpretation', hint: 'What you think this means for the research question, and how far you trust it.', control: 'textarea', rows: 3, value: record.interpretation ?? '', maxlength: EVIDENCE_LIMITS.interpretation.max, counter: true })}
    ${field({ id: `${prefix}-location`, label: 'Page, section or table', hint: 'So you can find it again, for example "p. 12", "Section 4.2" or "Table 3".', value: record.location ?? '', maxlength: EVIDENCE_LIMITS.location.max })}
    ${field({ id: `${prefix}-tags`, label: 'Tags', hint: `Separate with commas, for example "productivity, controlled experiment". Up to ${EVIDENCE_LIMITS.tags.max}.`, value: (record.tags ?? []).join(', '), maxlength: 400 })}
    <p class="form-status" role="alert"></p>
    <div class="actions"><button type="submit" class="btn btn--primary">${esc(submitLabel)}</button>${record.id ? `<button type="button" class="btn btn--secondary" data-cancel-edit>Cancel</button>` : ''}</div>`;
}

/** Cross-field rules for wireForm: a relationship must be chosen, and the tag list must be valid. */
export const evidenceChecks = (prefix) => [
  (form) => (form.querySelector(`input[name="${prefix}-rel"]:checked`) ? [] : [{ input: form.querySelector(`#${prefix}-rel-supports`), message: 'Choose how this evidence relates to the question.' }]),
  (form) => { const input = form.querySelector(`#${prefix}-tags`); const message = tagsError(input.value); return message ? [{ input, message }] : []; },
];

/** Form values -> repository input. */
export const readEvidence = (prefix, v) => ({
  researchQuestionId: v[`${prefix}-rq`], relationship: v[`${prefix}-rel`], evidence: v[`${prefix}-evidence`],
  interpretation: v[`${prefix}-interpretation`], location: v[`${prefix}-location`], tags: v[`${prefix}-tags`],
});

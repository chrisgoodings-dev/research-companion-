import { getPapers, getQuestion, setQuestion, updatePaper, removePaper } from './storage.js';
import { validateForm, liveValidate } from './forms.js';
import { el, setStatus, formatAuthors, formatMeta } from './site.js';

const STATUSES = { 'to-read': 'To read', reading: 'Reading', read: 'Read' };
const RELATIONSHIPS = {
  supports: 'Supports my question',
  contradicts: 'Contradicts my question',
  mixed: 'Mixed findings',
  contextual: 'Background or context',
  none: 'No evidence on my question',
};

const list = document.getElementById('saved');
const filter = document.getElementById('filter');
const questionForm = document.getElementById('question-form');

function radio(paper, value, label) {
  const id = `${paper.id}-rel-${value}`;
  const input = el('input', { type: 'radio', id, name: `rel-${paper.id}`, value });
  if (value === 'supports') input.required = true; // one required radio makes the whole group required
  if (paper.note?.relationship === value) input.checked = true;
  return el('div', { class: 'check' }, input, el('label', { for: id }, label));
}

function textField(paper, name, labelText, hintText, required) {
  const id = `${paper.id}-${name}`;
  const area = el('textarea', { id, name, maxlength: '1000', 'aria-describedby': `${id}-hint` });
  area.required = required;
  area.value = paper.note?.[name] ?? '';
  return el('div', { class: 'field' },
    el('label', { for: id }, labelText),
    el('p', { class: 'hint', id: `${id}-hint` }, hintText),
    area);
}

function noteForm(paper) {
  const form = el('form', { id: `note-${paper.id}`, novalidate: '' },
    el('fieldset', { id: `rel-${paper.id}` },
      el('legend', {}, 'How does this paper relate to your question?'),
      ...Object.entries(RELATIONSHIPS).map(([value, label]) => radio(paper, value, label))),
    textField(paper, 'evidence', 'Evidence', 'What the paper reports: findings, numbers, quotes. Keep your own opinion out of this box.', true),
    textField(paper, 'interpretation', 'Interpretation', 'What you think it means for your question (optional).', false),
    el('div', {}, el('button', { class: 'btn', type: 'submit' }, 'Save note')));

  liveValidate(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm(form).valid) { setStatus('Please fix the problems in the note form.', true); return; }
    const data = new FormData(form);
    updatePaper(paper.id, {
      note: {
        relationship: data.get(`rel-${paper.id}`),
        evidence: String(data.get('evidence')).trim(),
        interpretation: String(data.get('interpretation')).trim(),
      },
    });
    render(`Note saved for “${paper.title}”.`);
    document.getElementById(`status-${paper.id}`)?.focus(); // the card was redrawn: put focus back on it
  });
  return form;
}

function card(paper) {
  const statusId = `status-${paper.id}`;
  const select = el('select', { id: statusId },
    ...Object.entries(STATUSES).map(([value, label]) => el('option', { value }, label)));
  select.value = paper.status;
  select.addEventListener('change', () => {
    updatePaper(paper.id, { status: select.value });
    render(`“${paper.title}” marked as ${STATUSES[select.value].toLowerCase()}.`);
    document.getElementById(statusId)?.focus();
  });

  const remove = el('button', { class: 'btn btn-danger', type: 'button' }, 'Remove', el('span', { class: 'visually-hidden' }, `: ${paper.title}`));
  remove.addEventListener('click', () => {
    if (!confirm(`Remove “${paper.title}” from your reading list?`)) return;
    removePaper(paper.id);
    render(`Removed “${paper.title}”.`);
    filter.focus();
  });

  const question = getQuestion();
  return el('li', { class: 'card' },
    el('h2', {}, el('a', { href: `paper.html?id=${encodeURIComponent(paper.id)}` }, paper.title)),
    el('p', {}, formatAuthors(paper.authors)),
    el('p', { class: 'meta' }, formatMeta(paper)),
    el('div', { class: 'field' }, el('label', { for: statusId }, 'Reading status'), select),
    el('details', {},
      el('summary', {}, paper.note ? 'Evidence note ✓' : 'Add evidence note'),
      el('p', { class: 'hint' }, question ? `Your question: ${question}` : 'Add your research question above to give your notes context.'),
      noteForm(paper)),
    el('div', { class: 'actions' }, remove));
}

/** Draw the list for the current filter. `message` is announced to screen readers. */
function render(message) {
  const all = getPapers();
  const items = filter.value === 'all' ? all : all.filter((p) => p.status === filter.value);
  list.replaceChildren(...items.map(card));

  if (all.length === 0) {
    list.append(el('li', { class: 'card' }, el('p', {}, 'Your reading list is empty. '), el('a', { href: 'index.html' }, 'Search for papers to save')));
  }
  setStatus(message ?? (all.length ? `Showing ${items.length} of ${all.length} papers.` : ''));
}

questionForm.elements.question.value = getQuestion();
questionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (setQuestion(questionForm.elements.question.value.trim())) {
    render('Research question saved.');
  } else {
    setStatus('Could not save: this browser is blocking storage.', true);
  }
});
filter.addEventListener('change', () => render());

render();

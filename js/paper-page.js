import { getPaper } from './api.js';
import { addPaper, isSaved } from './storage.js';
import { validateForm } from './forms.js';
import { el, setStatus, formatMeta } from './site.js';

const saveForm = document.getElementById('save-form');
const saveButton = document.getElementById('save-btn');

function showSaved() {
  saveButton.disabled = true;
  saveButton.textContent = 'Saved ✓';
  saveForm.append(el('p', {}, el('a', { href: 'list.html' }, 'Go to your reading list')));
}

try {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const paper = await getPaper(id);

  document.title = `${paper.title} | SE Research Hub`;
  document.getElementById('paper-title').textContent = paper.title;
  document.getElementById('paper-authors').textContent = paper.authors.join(', ') || 'Unknown authors';
  document.getElementById('paper-meta').textContent =
    [formatMeta(paper), `Cited by ${paper.citedBy.toLocaleString()}`].filter(Boolean).join(' · ');
  document.getElementById('paper-abstract').textContent =
    paper.abstract || 'OpenAlex has no abstract for this paper. Use the link below to read it at the publisher.';

  const links = document.getElementById('paper-links');
  if (paper.url) links.append(el('li', {}, el('a', { href: paper.url }, 'Publisher page')));
  if (paper.openAccessUrl) links.append(el('li', {}, el('a', { href: paper.openAccessUrl }, 'Free full text')));

  if (isSaved(paper.id)) {
    showSaved();
    saveForm.prepend(el('p', {}, 'This paper is already in your reading list.'));
  }

  saveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm(saveForm).valid) return;
    if (addPaper(paper, saveForm.elements.status.value)) {
      showSaved();
      setStatus('Saved to your reading list.');
    } else {
      setStatus('Could not save: this browser is blocking storage.', true);
    }
  });

  document.getElementById('paper').hidden = false;
  setStatus('');
} catch (err) {
  setStatus(err.message, true);
}

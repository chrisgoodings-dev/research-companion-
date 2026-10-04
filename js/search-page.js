import { searchPapers } from './api.js';
import { addPaper, isSaved } from './storage.js';
import { validateForm, liveValidate } from './forms.js';
import { el, setStatus, formatAuthors, formatMeta } from './site.js';

const form = document.getElementById('search-form');
const results = document.getElementById('results');
const moreButton = document.getElementById('more');

let query = null; // the search currently shown
let page = 1;
let shown = 0;

form.elements.from.max = new Date().getFullYear(); // no future years

/** One result card. The Save button writes straight to the reading list. */
function card(paper) {
  const saved = isSaved(paper.id);
  const button = el('button', { class: 'btn btn-secondary', type: 'button' },
    saved ? 'Saved ✓' : 'Save to list', el('span', { class: 'visually-hidden' }, `: ${paper.title}`));
  button.disabled = saved;
  button.addEventListener('click', () => {
    if (addPaper(paper, 'to-read')) {
      button.firstChild.textContent = 'Saved ✓';
      button.disabled = true;
      setStatus(`Saved “${paper.title}” to your reading list.`);
    } else {
      setStatus('Could not save: this browser is blocking storage.', true);
    }
  });

  return el('li', { class: 'card' },
    el('h2', {}, el('a', { href: `paper.html?id=${encodeURIComponent(paper.id)}` }, paper.title)),
    el('p', {}, formatAuthors(paper.authors)),
    el('p', { class: 'meta' }, formatMeta(paper)),
    paper.isOpenAccess ? el('p', {}, el('span', { class: 'badge' }, '✓ Open access')) : '',
    button);
}

async function loadResults() {
  moreButton.disabled = true;
  setStatus(page === 1 ? 'Searching…' : 'Loading more results…');
  try {
    const { total, papers } = await searchPapers({ ...query, page });
    results.append(...papers.map(card));
    shown += papers.length;
    if (total === 0) setStatus(`No papers found for “${query.q}”. Try different keywords or remove the filters.`);
    else setStatus(`Showing ${shown} of ${total.toLocaleString()} papers.`);
    moreButton.hidden = shown >= total || papers.length === 0;
  } catch (err) {
    setStatus(err.message, true);
    moreButton.hidden = page === 1; // let the user retry loading more
  } finally {
    moreButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const { valid, count } = validateForm(form);
  if (!valid) {
    setStatus(count === 1 ? 'Please fix the problem below.' : `Please fix the ${count} problems below.`, true);
    return;
  }
  form.submit(); // a normal GET to ?q=...: the address can be shared and the Back button works
});
liveValidate(form);

moreButton.addEventListener('click', () => { page += 1; loadResults(); });

// Fill the form from the address and run the search it describes.
const params = new URLSearchParams(location.search);
form.elements.q.value = params.get('q') ?? '';
form.elements.from.value = params.get('from') ?? '';
form.elements.sort.value = ['relevance', 'newest', 'cited'].includes(params.get('sort')) ? params.get('sort') : 'relevance';
form.elements.oa.checked = params.get('oa') === '1';

if (form.elements.q.value.trim().length >= 2 && validateForm(form).valid) {
  query = {
    q: form.elements.q.value.trim(),
    from: form.elements.from.value,
    sort: form.elements.sort.value,
    openAccess: form.elements.oa.checked,
  };
  loadResults();
}

// Small helpers shared by every page.

/** Create an element: el('a', { href: '#' }, 'text'). Text is always set as text, never as HTML. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/** Say something in the page's live region so screen readers announce it. */
export function setStatus(message, isError = false) {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

/** Authors for a card: first three, then "and N more". */
export function formatAuthors(authors) {
  if (!authors.length) return 'Unknown authors';
  const shown = authors.slice(0, 3).join(', ');
  return authors.length > 3 ? `${shown} and ${authors.length - 3} more` : shown;
}

export const formatMeta = (paper) => [paper.year, paper.venue].filter(Boolean).join(' · ');

// Menu button for small screens. The "js" class tells the CSS that the button works.
document.documentElement.classList.add('js');
const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelector('.site-header').addEventListener('keydown', (event) => { // Escape works from the button or the links
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

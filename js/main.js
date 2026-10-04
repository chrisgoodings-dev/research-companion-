import { routes } from './views/index.js';
import { startRouter } from './router.js';
import { initTheme } from './ui/theme.js';
import { keepFocusClearOfFixedBars } from './ui/focus.js';

function init() {
  initTheme(document.getElementById('theme-toggle'));
  keepFocusClearOfFixedBars();

  // The skip link must not change the hash (it is the router's state), so focus <main> directly.
  document.querySelector('.skip-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('main').focus();
  });

  const menu = document.getElementById('more-menu');
  const menuBtn = document.getElementById('menu-btn');
  menuBtn.addEventListener('click', () => menu.showModal());
  document.getElementById('menu-close').addEventListener('click', () => menu.close());
  // Choosing a destination (hash link) closes the sheet.
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.close(); });

  startRouter({ routes, outlet: document.getElementById('main') });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

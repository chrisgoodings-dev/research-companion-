const KEY = 'seh-theme';

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || t === 'light' ? t : (systemPrefersDark() ? 'dark' : 'light');
}

function render(button) {
  const dark = effectiveTheme() === 'dark';
  button.setAttribute('aria-pressed', String(dark));
  button.querySelector('.theme-toggle__label').textContent = 'Dark theme';
}

/** Wire up the theme toggle. The choice is a small preference, so localStorage is appropriate. */
export function initTheme(button) {
  render(button);
  button.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage may be unavailable */ }
    render(button);
  });
}

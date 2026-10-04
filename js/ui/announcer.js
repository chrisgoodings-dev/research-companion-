/** Send a message to the polite live region so screen-reader users hear it (WCAG 4.1.3). */
export function announce(message) {
  const el = document.getElementById('announcer');
  if (!el) return;
  el.textContent = '';
  // Clear then set on the next frame so repeated identical messages are still announced.
  requestAnimationFrame(() => { el.textContent = message; });
}

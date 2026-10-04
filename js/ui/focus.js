/** WCAG 2.2 · 2.4.11 Focus Not Obscured (Minimum).
 *  On phones the primary navigation is a fixed bar along the bottom of the screen. Browsers only scroll a focused
 *  control into view if it is outside the viewport, and a control sitting just above the bottom edge IS inside the
 *  viewport, so it can end up hidden behind the bar. `scroll-padding-bottom` (see layout.css) is not applied to
 *  focus changes in that case, so this scrolls the page just far enough to clear the bar. */
export function keepFocusClearOfFixedBars() {
  document.addEventListener('focusin', (event) => {
    const el = event.target;
    if (!(el instanceof Element)) return;
    for (const bar of document.querySelectorAll('.nav')) {
      if (bar.contains(el) || getComputedStyle(bar).position !== 'fixed') continue;
      const barTop = bar.getBoundingClientRect().top;
      const bottom = el.getBoundingClientRect().bottom;
      if (bottom > barTop) window.scrollBy({ top: bottom - barTop + 16, behavior: 'instant' });
    }
  });
}

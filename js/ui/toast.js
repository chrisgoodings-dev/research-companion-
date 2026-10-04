import { announce } from './announcer.js';

/** A brief visible confirmation. Screen-reader users are told through the live region instead
 *  (so the toast itself is aria-hidden and never announced twice). */
export function showToast(message) {
  announce(message);
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), 6000);
}

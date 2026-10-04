/** Promise-based confirmation using the native <dialog> (focus trap + Esc come for free).
 *  Cancel is the first button, so it receives initial focus: destructive actions are never the default. */
export function confirmAction({ title, body, confirmLabel = 'Delete' }) {
  const dialog = document.getElementById('confirm-dialog');
  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-body').textContent = body;
  const ok = dialog.querySelector('#confirm-ok');
  ok.textContent = confirmLabel;
  return new Promise((resolve) => {
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}

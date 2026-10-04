const LAST_KEY = 'seh-last-project';

const remembered = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const remember = (id) => { try { localStorage.setItem(LAST_KEY, id); } catch { /* preference only */ } };

/** Ask which project to save a paper to. Resolves with a project id, or null if cancelled.
 *  Native <dialog>: focus is trapped, Esc cancels and focus returns to the button that opened it. */
export function chooseProject({ paperTitle, projects }) {
  const dialog = document.getElementById('save-dialog');
  const select = dialog.querySelector('#save-project');
  dialog.querySelector('#save-paper').textContent = paperTitle;

  const preferred = projects.some((p) => p.id === remembered()) ? remembered() : projects[0]?.id;
  select.replaceChildren(...projects.map((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name; // textContent: project names are user data, never markup
    option.selected = p.id === preferred;
    return option;
  }));

  return new Promise((resolve) => {
    dialog.returnValue = '';
    dialog.addEventListener('close', () => {
      const chosen = dialog.returnValue === 'save' ? select.value : null;
      if (chosen) remember(chosen);
      resolve(chosen);
    }, { once: true });
    dialog.showModal();
  });
}

/** Save text as a file through the browser's normal download (no server involved). */
export function downloadText(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const stamp = (d = new Date()) => d.toISOString().slice(0, 10);

const KEY = 'seh-last-backup';
export const lastBackup = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const markBackup = () => { try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* preference only */ } };

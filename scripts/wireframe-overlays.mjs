// Wireframe for the overlays that are not pages: dialogs, the phone menu sheet and toasts.
import { Painter, wrap } from './wireframe-lib.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dialog(P, x, y, w, { title, body, field, buttons, focusFirst = true }) {
  let cy = y + 14;
  const parts = [];
  const [h, svg] = P.capture(() => {
    P.text(x + 14, cy + 12, title, { size: 12, weight: 700 }); cy += 24;
    if (field) { P.text(x + 14, cy + 6, field.label, { size: 9.5, weight: 700 }); cy += 11; wrap(field.hint, w - 28, 9).forEach((l) => { P.text(x + 14, cy + 6, l, { size: 9, fill: '#777' }); cy += 11; }); P.rect(x + 14, cy + 2, w - 28, 22, { stroke: '#555', r: 3 }); P.text(x + 20, cy + 17, field.value, { size: 10, fill: '#555' }); P.text(x + w - 28, cy + 17, '▾', { size: 10 }); cy += 32; }
    wrap(body, w - 28, 10).forEach((l) => { P.text(x + 14, cy + 8, l, { size: 10, fill: '#333' }); cy += 13; });
    cy += 8;
    let bx = x + 14;
    buttons.forEach((bt, i) => { const bw = bt.s.length * 5.9 + 22; const focus = focusFirst && i === 0; if (focus) P.rect(bx - 3, cy - 3, bw + 6, 28, { stroke: '#c0392b', sw: 2.5, fill: 'none', r: 6 }); P.rect(bx, cy, bw, 22, { fill: bt.p ? '#333' : '#fff', stroke: bt.d ? '#a11d33' : '#333', sw: 1.5, r: 4 }); P.text(bx + bw / 2, cy + 15, bt.s, { size: 10, weight: 700, anchor: 'middle', fill: bt.p ? '#fff' : bt.d ? '#a11d33' : '#222' }); bx += bw + 10; });
    cy += 30;
    return cy + 8 - y;
  });
  P.rect(x, y, w, h, { fill: '#fff', stroke: '#222', sw: 2, r: 8 });
  P.push(svg);
  return h;
}

export const overlays = () => {
  const P = new Painter();
  const W = 1040; let H = 0;
  const panelW = 320; const gap = 20; const X = [20, 20 + panelW + gap, 20 + 2 * (panelW + gap)];
  const top = 70;
  const label = (x, s) => P.text(x, top - 10, s, { size: 10, weight: 700, fill: '#666' });

  // Panel 1: confirm dialog on a dimmed page
  label(X[0], 'CONFIRM DIALOG (delete, replace, discard)');
  P.rect(X[0], top, panelW, 330, { fill: '#9a9a9a', stroke: '#222', sw: 2 });
  P.text(X[0] + 10, top + 20, 'page behind is inert and dimmed', { size: 9, fill: '#fff', italic: true });
  const h1 = dialog(P, X[0] + 30, top + 80, panelW - 60, { title: 'Delete “AI-assisted coding”?', body: 'This also deletes 3 research questions, 2 saved paper links and any linked evidence. This cannot be undone.', buttons: [{ s: 'Cancel' }, { s: 'Delete project', d: 1 }] });
  P.callout(1, X[0] + 22, top + 88);

  // Panel 2: save to project dialog
  label(X[1], 'SAVE TO PROJECT DIALOG (Discover)');
  P.rect(X[1], top, panelW, 330, { fill: '#9a9a9a', stroke: '#222', sw: 2 });
  const h2 = dialog(P, X[1] + 30, top + 70, panelW - 60, { title: 'Save to project', body: 'A paper can be saved to more than one project.', field: { label: 'Project (required)', hint: 'Productivity Assessment of Neural Code Completion', value: 'AI-assisted coding' }, buttons: [{ s: 'Cancel' }, { s: 'Save paper', p: 1 }] });
  P.callout(2, X[1] + 22, top + 78);

  // Panel 3: phone menu sheet
  label(X[2], 'MENU SHEET (phones only)');
  P.rect(X[2] + 40, top, 240, 330, { fill: '#9a9a9a', stroke: '#222', sw: 2, r: 10 });
  const sx = X[2] + 60; const sw = 200; let sy = top + 60;
  const [sh, ssvg] = P.capture(() => {
    let cy = sy + 14; P.text(sx + 14, cy + 12, 'More', { size: 12, weight: 700 }); cy += 26;
    ['Projects', 'Evidence', 'Matrix', 'Progress', 'Backup & export'].forEach((s) => { P.rect(sx + 14, cy, sw - 28, 24, { r: 4, stroke: '#888' }); P.text(sx + 24, cy + 16, s, { size: 10, weight: 700 }); cy += 29; });
    P.rect(sx + 14, cy + 4, 110, 22, { r: 4, stroke: '#333', sw: 1.5 }); P.text(sx + 69, cy + 19, 'Close menu', { size: 10, weight: 700, anchor: 'middle' }); cy += 38;
    return cy - sy;
  });
  P.rect(sx, sy, sw, sh, { fill: '#fff', stroke: '#222', sw: 2, r: 8 }); P.push(ssvg);
  P.callout(3, sx - 8, sy + 8);
  P.rect(X[2] + 40, top + 330 - 38, 240, 38, { fill: '#3b3b3b', stroke: '#222', sw: 2, r: 10 });
  ['Dashboard', 'Discover', 'Library', 'Menu'].forEach((s, i) => P.text(X[2] + 40 + i * 60 + 30, top + 330 - 15, s, { size: 8.5, fill: '#fff', anchor: 'middle', weight: s === 'Menu' ? 700 : 400 }));

  // Row 2: toast + live region
  const r2 = top + 330 + 50;
  label2(P, X[0], r2 - 10, 'TOAST (a brief confirmation)');
  P.rect(X[0], r2, 480, 150, { stroke: '#222', sw: 2 });
  P.rect(X[0] + 8, r2 + 8, 464, 16, { fill: '#eee', stroke: '#bbb' }); P.text(X[0] + 14, r2 + 20, 'page content (the toast sits at the TOP so it never covers a Save button)', { size: 9, fill: '#777' });
  P.rect(X[0] + 300, r2 + 30, 172, 28, { fill: '#222', stroke: '#222', r: 6 }); P.text(X[0] + 386, r2 + 48, 'Evidence added', { size: 10, weight: 700, fill: '#fff', anchor: 'middle' });
  P.callout(4, X[0] + 292, r2 + 38);
  P.rect(X[0] + 8, r2 + 74, 464, 64, { fill: '#f4f4f4', stroke: '#999', dash: '4 3', r: 4 });
  P.text(X[0] + 16, r2 + 90, 'Polite live region (visually hidden, always present):', { size: 9, weight: 700 });
  P.text(X[0] + 16, r2 + 104, '“Evidence added”  “3 results for copilot. Page 1 of 62.”  “Review saved”', { size: 9, fill: '#333' });
  P.text(X[0] + 16, r2 + 118, '“Projects page” (on every route change, with focus moved to the heading)', { size: 9, fill: '#333' });
  P.callout(5, X[0] + 8, r2 + 80);

  H = r2 + 170;
  // Legend
  const notes = {
    1: 'Native <dialog> opened with showModal(): focus is trapped inside, the page behind is inert, Esc cancels, and focus returns to the button that opened it. CANCEL is the first button and receives initial focus (red ring), so pressing Enter by mistake never destroys data. Used for delete, replace-everything and discard-unsaved-changes.',
    2: 'The same dialog pattern for choosing a project when saving a paper. The last-used project is preselected; projects that already contain the paper are not offered.',
    3: 'The phone Menu button opens the same kind of dialog with the destinations that do not fit in the bottom bar. Choosing a link closes it.',
    4: 'Toasts appear at the top of the screen for six seconds. They are marked aria-hidden so they are never read twice; they are a visual confirmation only.',
    5: 'The announcement is made through one polite live region that exists from page load: search results, saves, deletes, route changes and project changes in the matrix and progress pages.',
  };
  let ly = H; P.text(20, ly, 'Annotations', { size: 12, weight: 700 }); ly += 8;
  const colW = 500; const ys = [ly, ly];
  Object.entries(notes).forEach(([n, t], i) => { const col = i % 2; const L = wrap(t, colW - 24, 10); const cx = 20 + col * (colW + 20); const cy = ys[col] + 14; P.callout(n, cx + 8, cy - 3); L.forEach((l, k) => P.text(cx + 22, cy + k * 13, l, { size: 10 })); ys[col] = cy + L.length * 13 + 4; });
  const total = Math.max(...ys) + 18;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${total}" viewBox="0 0 ${W} ${total}" font-family="Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="20" y="26" font-size="18" font-weight="700" fill="#111">Overlays: dialogs, menu sheet and toasts</text><text x="20" y="44" font-size="11" fill="#555">Not pages: opened from within pages  ·  js/ui/confirm.js, js/ui/saveDialog.js, js/ui/toast.js, js/ui/announcer.js</text>${P.out.join('')}</svg>`;
  return [{ file: 'overlays', svg }];
};

function label2(P, x, y, s) { P.text(x, y, s, { size: 10, weight: 700, fill: '#666' }); }

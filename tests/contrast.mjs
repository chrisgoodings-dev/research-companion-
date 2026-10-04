// WCAG 2.x contrast checker for the design tokens. Run: npm run contrast
// Results feed the accessibility evidence in the write-up (WCAG 1.4.3 / 1.4.11).
const lum = (hex) => {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const pairs = [
  // [label, foreground, background, minimum]
  ['Light: body text on canvas', '#11252a', '#f5f7fa', 4.5],
  ['Light: body text on surface', '#11252a', '#ffffff', 4.5],
  ['Light: muted text on canvas', '#46595f', '#f5f7fa', 4.5],
  ['Light: muted text on surface', '#46595f', '#ffffff', 4.5],
  ['Light: link/accent teal-700 on canvas', '#0f766e', '#f5f7fa', 4.5],
  ['Light: link/accent teal-700 on surface', '#0f766e', '#ffffff', 4.5],
  ['Light: primary button text on teal-700', '#ffffff', '#0f766e', 4.5],
  ['Light: focus ring on canvas (non-text)', '#0b5a54', '#f5f7fa', 3],
  ['Light: form-control border on surface (non-text, 1.4.11)', '#5f7379', '#ffffff', 3],
  ['Dark: form-control border on graphite-800 (non-text)', '#7f9ca1', '#1a2a2e', 3],
  ['Dark: body text on graphite-900', '#e2fbf8', '#0d1b1e', 4.5],
  ['Dark: body text on graphite-800', '#e2fbf8', '#1a2a2e', 4.5],
  ['Dark: muted text on graphite-800', '#a9c4c7', '#1a2a2e', 4.5],
  ['Dark: accent teal-300 on graphite-800', '#5eead4', '#1a2a2e', 4.5],
  ['Dark: primary button text on teal-300', '#0d1b1e', '#5eead4', 4.5],
  ['Sidebar: nav text on graphite-900', '#e2fbf8', '#0d1b1e', 4.5],
  ['Sidebar: muted nav text on graphite-900', '#a9c4c7', '#0d1b1e', 4.5],
  ['Sidebar: muted nav text on active graphite-700', '#a9c4c7', '#23363b', 4.5],
  ['Sidebar: active text on graphite-700', '#e2fbf8', '#23363b', 4.5],
  ['Sidebar: accent bar teal-300 on graphite-900 (non-text)', '#5eead4', '#0d1b1e', 3],
  ['Light: error text (danger) on surface', '#a11d33', '#ffffff', 4.5],
  ['Light: error text (danger) on canvas', '#a11d33', '#f5f7fa', 4.5],
  ['Light: danger button text on danger', '#ffffff', '#a11d33', 4.5],
  ['Dark: error text on graphite-800', '#ff9aa9', '#1a2a2e', 4.5],
  ['Dark: danger button text on danger', '#0d1b1e', '#ff9aa9', 4.5],
  ['Toast: text on graphite-900', '#e2fbf8', '#0d1b1e', 4.5],
  ['Light: open-access badge text on surface', '#166534', '#ffffff', 4.5],
  ['Dark: open-access badge text on graphite-800', '#86efac', '#1a2a2e', 4.5],
  ['REJECTED: white on teal-500 (why teal-700 is used)', '#ffffff', '#14b8a6', 4.5],
  ['REJECTED: teal-500 text on canvas', '#14b8a6', '#f5f7fa', 4.5],
];

let failed = 0;
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const rejected = label.startsWith('REJECTED');
  const ok = r >= min;
  const status = rejected ? (ok ? 'UNEXPECTED PASS' : 'fails (as expected)') : ok ? 'PASS' : 'FAIL';
  if (!rejected && !ok) failed++;
  console.log(`${status.padEnd(20)} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`);
}
process.exit(failed ? 1 : 0);

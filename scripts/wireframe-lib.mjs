// A tiny low-fidelity wireframe toolkit. A page is a list of BLOCKS; the same blocks are laid out twice,
// once at desktop width (two columns, sidebar) and once at phone width (one column, bottom bar).
// Blocks may carry n: a number that becomes a numbered callout, explained in the legend underneath.

const CW = 0.54; // average character width as a fraction of font size (Arial)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const wrap = (s, w, size) => {
  const max = Math.max(4, Math.floor(w / (size * CW)));
  const lines = [];
  let line = '';
  for (const word of String(s).split(' ')) {
    if ((line + ' ' + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
};

export class Painter {
  constructor() { this.out = []; this.callouts = []; }
  push(s) { this.out.push(s); }
  /** Draw into a fresh buffer and return [height, svg]. */
  capture(fn) { const saved = this.out; this.out = []; const h = fn(); const svg = this.out.join(''); this.out = saved; return [h, svg]; }
  text(x, y, s, { size = 11, weight = 400, fill = '#222', anchor = 'start', italic = false, underline = false } = {}) {
    this.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}${underline ? ' text-decoration="underline"' : ''}>${esc(s)}</text>`);
  }
  rect(x, y, w, h, { fill = '#fff', stroke = '#333', sw = 1, dash = '', r = 0 } = {}) {
    this.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  line(x1, y1, x2, y2, { stroke = '#999', sw = 1, dash = '' } = {}) { this.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`); }
  callout(n, x, y) {
    this.push(`<circle cx="${x}" cy="${y}" r="8" fill="#c0392b"/><text x="${x}" y="${y + 4}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`);
  }
}

const GAP = 8;
const fit = (s, w, size) => { const max = Math.floor(w / (size * CW)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s; };

/** Lay out one block at (x, y) with width w. Draws, and returns the height used. */
export function layout(P, b, x, y, w, m) {
  const h = draw(P, b, x, y, w, m);
  if (b.n) P.callout(b.n, x - 11, y + 8);
  return h;
}

function stack(P, blocks, x, y, w, m, gap = GAP) {
  let cy = y;
  for (const b of blocks) cy += layout(P, b, x, cy, w, m) + gap;
  return cy - y - (blocks.length ? gap : 0);
}

function draw(P, b, x, y, w, m) {
  switch (b.t) {
    case 'h1': { const L = wrap(b.s, w, 17); L.forEach((l, i) => P.text(x, y + 16 + i * 21, l, { size: 17, weight: 700 })); return L.length * 21 + 5; }
    case 'h2': P.text(x, y + 13, b.s, { size: 13, weight: 700 }); return 22;
    case 'h3': P.text(x, y + 11, b.s, { size: 11, weight: 700 }); return 18;
    case 'p': { const L = wrap(b.s, w, 10); L.forEach((l, i) => P.text(x, y + 10 + i * 13, l, { size: 10, fill: '#555' })); return L.length * 13 + 4; }
    case 'note': { const L = wrap(b.s, w, 9); L.forEach((l, i) => P.text(x, y + 9 + i * 12, l, { size: 9, fill: '#777', italic: true })); return L.length * 12 + 2; }
    case 'crumb': { const L = wrap(b.s, w, 9.5); L.forEach((l, i) => P.text(x, y + 10 + i * 12, l, { size: 9.5, fill: '#555' })); return L.length * 12 + 6; }
    case 'spacer': return b.h ?? 8;
    case 'bullets': { let cy = y; for (const s of b.items) { const L = wrap(s, w - 12, 10); P.text(x, cy + 10, '•', { size: 10 }); L.forEach((l, i) => P.text(x + 10, cy + 10 + i * 13, l, { size: 10 })); cy += L.length * 13 + 3; } return cy - y; }
    case 'stack': return stack(P, b.c, x, y, w, m, b.gap ?? GAP);
    case 'cols': {
      if (m) return stack(P, b.c, x, y, w, m);
      const gap = 14; const ratio = b.ratio ?? [2, 1]; const total = ratio.reduce((a, c) => a + c, 0);
      const ws = ratio.map((r) => ((w - gap * (b.c.length - 1)) * r) / total);
      let cx = x; let max = 0;
      b.c.forEach((c, i) => { max = Math.max(max, layout(P, c, cx, y, ws[i], m)); cx += ws[i] + gap; });
      return max;
    }
    case 'grid': { // equal columns of blocks: desktop n columns, phone 2 (or 1 with b.phone === 1)
      const cols = m ? (b.phone ?? 2) : b.cols; const gap = 8; const cw = (w - gap * (cols - 1)) / cols;
      let rowH = 0; let cy = y; let max = 0;
      b.c.forEach((c, i) => { const col = i % cols; const hh = layout(P, c, x + col * (cw + gap), cy, cw, m); rowH = Math.max(rowH, hh); if (col === cols - 1 || i === b.c.length - 1) { cy += rowH + gap; max = cy - y - gap; rowH = 0; } });
      return max;
    }
    case 'card': {
      const pad = 10; const inner = [];
      const [hh, svg] = P.capture(() => {
        let cy = y + pad;
        if (b.title) { P.text(x + pad, cy + 12, b.title, { size: 12, weight: 700 }); cy += 22; }
        cy += stack(P, b.c ?? [], x + pad, cy, w - pad * 2, m);
        return cy + pad - y;
      });
      P.rect(x, y, w, hh, { fill: b.fill ?? '#fff', stroke: b.dash ? '#a11d33' : '#555', dash: b.dash ? '5 3' : '', r: 4, sw: b.dash ? 1.5 : 1 });
      P.push(svg);
      return hh;
    }
    case 'stat': P.rect(x, y, w, 50, { r: 4, stroke: '#555' }); P.text(x + 10, y + 26, b.v, { size: 20, weight: 700 }); P.text(x + 10, y + 42, b.s, { size: 9, fill: '#555' }); return 50;
    case 'field': { // label, optional hint, control, optional counter
      let cy = y;
      P.text(x, cy + 10, b.s + (b.req === false ? ' (optional)' : b.req ? ' (required)' : ''), { size: 10, weight: 700 }); cy += 15;
      if (b.hint) { const L = wrap(b.hint, w, 9); L.forEach((l, i) => P.text(x, cy + 8 + i * 11, l, { size: 9, fill: '#777' })); cy += L.length * 11 + 3; }
      const ch = b.k === 'textarea' ? (b.rows ?? 3) * 14 + 8 : 22;
      P.rect(x, cy, w, ch, { stroke: '#555', r: 3 });
      if (b.v) P.text(x + 6, cy + 15, b.v, { size: 10, fill: '#555' });
      if (b.k === 'select') { P.text(x + w - 14, cy + 15, '▾', { size: 10 }); }
      if (b.k === 'search') { P.text(x + w - 16, cy + 15, '⌕', { size: 12 }); }
      if (b.err) { P.rect(x, cy, w, ch, { stroke: '#a11d33', sw: 2.5, fill: 'none', r: 3 }); P.text(x, cy + ch + 11, '⚠ ' + b.err, { size: 9, weight: 700, fill: '#a11d33' }); cy += 13; }
      cy += ch;
      if (b.counter) { P.text(x + w, cy + 11, b.counter, { size: 8.5, fill: '#777', anchor: 'end' }); cy += 13; }
      return cy - y;
    }
    case 'fields': { // a row of fields: desktop side by side, phone stacked
      const cols = m ? 1 : b.c.length; const gap = 10; const cw = (w - gap * (cols - 1)) / cols;
      let cy = y; let rowMax = 0;
      b.c.forEach((c, i) => { const col = i % cols; const hh = layout(P, c, x + col * (cw + gap), cy, cw, m); rowMax = Math.max(rowMax, hh); if (col === cols - 1) { cy += rowMax + GAP; rowMax = 0; } });
      return cy - y - GAP;
    }
    case 'fieldset': {
      const [hh, svg] = P.capture(() => { let cy = y + 12; cy += stack(P, b.c, x + 8, cy, w - 16, m); return cy + 8 - y; });
      P.rect(x, y + 6, w, hh - 6, { stroke: '#888', r: 4 });
      P.rect(x + 8, y, b.s.length * 5.5 + 10, 12, { stroke: 'none', fill: b.bg ?? '#fff' });
      P.text(x + 12, y + 10, b.s, { size: 10, weight: 700 });
      P.push(svg); return hh;
    }
    case 'radios': { let cy = y; (b.opts).forEach((o) => { P.push(`<circle cx="${x + 6}" cy="${cy + 7}" r="5" fill="#fff" stroke="#333"/>`); if (o.on) P.push(`<circle cx="${x + 6}" cy="${cy + 7}" r="2.5" fill="#333"/>`); P.text(x + 16, cy + 10, o.s ?? o, { size: 10, weight: 700 }); cy += 15; if (o.d) { const L = wrap(o.d, w - 16, 9); L.forEach((l, i) => P.text(x + 16, cy + 6 + i * 11, l, { size: 9, fill: '#777' })); cy += L.length * 11 + 3; } }); return cy - y; }
    case 'checks': { let cy = y; b.opts.forEach((o) => { P.rect(x, cy + 1, 11, 11, { r: 2, stroke: '#333' }); if (o.on ?? true) P.text(x + 2, cy + 10, '✓', { size: 10, weight: 700 }); P.text(x + 17, cy + 10, o.s ?? o, { size: 10, weight: 700 }); cy += 16; if (o.d) { P.text(x + 17, cy + 6, o.d, { size: 9, fill: '#777' }); cy += 11; } }); return cy - y; }
    case 'buttons': {
      let cx = x; let cy = y; const hh = 22;
      b.items.forEach((it) => { const lab0 = it.s ?? it; const bw = Math.min(lab0.length * 5.9 + 20, w); const lab = fit(lab0, bw - 14, 10); if (cx + bw > x + w && cx > x) { cx = x; cy += hh + 6; }
        const prim = it.p; const danger = it.d;
        P.rect(cx, cy, bw, hh, { fill: prim ? '#333' : '#fff', stroke: danger ? '#a11d33' : '#333', sw: 1.5, r: 4 });
        P.text(cx + bw / 2, cy + 15, lab, { size: 10, weight: 700, fill: prim ? '#fff' : danger ? '#a11d33' : '#222', anchor: 'middle' }); cx += bw + 6; });
      return cy + hh - y;
    }
    case 'chips': { let cx = x; let cy = y; b.items.forEach((s) => { const bw = s.length * 5.4 + 14; if (cx + bw > x + w && cx > x) { cx = x; cy += 20; } P.rect(cx, cy, bw, 16, { r: 8, stroke: '#777' }); P.text(cx + bw / 2, cy + 11, s, { size: 9, anchor: 'middle' }); cx += bw + 5; }); return cy + 16 - y; }
    case 'badges': { let cx = x; b.items.forEach((s) => { const bw = s.length * 5.6 + 14; P.rect(cx, y, bw, 16, { r: 8, stroke: '#333', sw: 1.5 }); P.text(cx + bw / 2, y + 11, s, { size: 9, weight: 700, anchor: 'middle' }); cx += bw + 5; }); return 18; }
    case 'tabs': { const lab = b.items; const tw = Math.min(w / lab.length, 90); lab.forEach((s, i) => { const on = i === b.on; P.rect(x + i * tw, y, tw, 24, { fill: on ? '#fff' : '#eee', stroke: '#555', r: 3 }); P.text(x + i * tw + tw / 2, y + 16, s, { size: 10, weight: on ? 700 : 400, anchor: 'middle' }); if (on) P.rect(x + i * tw, y + 22, tw, 3, { fill: '#333', stroke: 'none' }); }); P.line(x, y + 24, x + w, y + 24, { stroke: '#555' }); return 30; }
    case 'progress': { P.text(x, y + 10, b.s, { size: 10, weight: 700 }); P.rect(x, y + 15, w, 12, { r: 6, stroke: '#555' }); P.rect(x + 1, y + 16, Math.max(2, (w - 2) * b.pct), 10, { r: 5, fill: '#555', stroke: 'none' }); return 32; }
    case 'link': P.text(x, y + 11, b.s, { size: 10.5, weight: b.bold ? 700 : 400, underline: true }); return 17;
    case 'line': { const L = wrap(b.s, w, b.size ?? 10); L.forEach((l, i) => P.text(x, y + 10 + i * 13, l, { size: b.size ?? 10, weight: b.bold ? 700 : 400, fill: b.fill ?? '#222' })); return L.length * 13 + 2; }
    case 'bars': { for (let i = 0; i < b.k; i++) P.rect(x, y + 3 + i * 11, i === b.k - 1 ? w * 0.6 : w, 5, { fill: '#ddd', stroke: 'none', r: 2 }); return b.k * 11 + 4; }
    case 'details': { P.text(x, y + 11, '▸ ' + b.s, { size: 10, weight: 700 }); return 18; }
    case 'dl': { let cy = y; b.rows.forEach(([k, v]) => { if (m) { P.text(x, cy + 9, k, { size: 9, weight: 700, fill: '#777' }); P.text(x, cy + 21, v, { size: 10 }); cy += 26; } else { P.text(x, cy + 10, k, { size: 9, weight: 700, fill: '#777' }); P.text(x + 70, cy + 10, v, { size: 10 }); cy += 16; } }); return cy - y; }
    case 'evidence': { // evidence card: head, question, blocks
      const pad = 8;
      const [hh, svg] = P.capture(() => {
        let cy = y + pad;
        P.rect(x + pad, cy, 24, 14, { r: 7, stroke: '#777' }); P.text(x + pad + 12, cy + 10, b.rq, { size: 8, anchor: 'middle' });
        const bw = b.rel.length * 5.4 + 22; P.rect(x + pad + 30, cy, bw, 14, { r: 7, stroke: '#333', sw: 1.5 }); P.text(x + pad + 30 + bw / 2, cy + 10, b.rel, { size: 8, weight: 700, anchor: 'middle' });
        cy += 20;
        const Lq = wrap(b.q, w - pad * 2, 9.5); Lq.forEach((l, i) => P.text(x + pad, cy + 9 + i * 12, l, { size: 9.5, weight: 700 })); cy += Lq.length * 12 + 4;
        if (b.paper) { P.text(x + pad, cy + 9, 'Paper: ' + b.paper, { size: 9, fill: '#555', underline: true }); cy += 15; }
        const blk = (label, text, dashed) => { const L = wrap(text, w - pad * 2 - 14, 9.5); const bh = L.length * 12 + 20; P.rect(x + pad, cy, w - pad * 2, bh, { fill: '#f6f6f6', stroke: '#bbb' }); P.line(x + pad, cy, x + pad, cy + bh, { stroke: '#333', sw: dashed ? 3 : 4, dash: dashed ? '3 2' : '' }); P.text(x + pad + 8, cy + 11, label, { size: 8, weight: 700, fill: '#666' }); L.forEach((l, i) => P.text(x + pad + 8, cy + 23 + i * 12, l, { size: 9.5 })); cy += bh + 5; };
        blk('FROM THE PAPER', b.ev, false);
        if (b.mine) blk('YOUR INTERPRETATION', b.mine, true);
        if (b.tags) { let cx = x + pad; b.tags.forEach((s) => { const tw = s.length * 5.4 + 14; P.rect(cx, cy, tw, 15, { r: 7, stroke: '#777' }); P.text(cx + tw / 2, cy + 10.5, s, { size: 8.5, anchor: 'middle' }); cx += tw + 4; }); cy += 21; }
        if (b.actions) { let cx = x + pad; b.actions.forEach((s) => { const bw2 = s.length * 5.9 + 18; P.rect(cx, cy, bw2, 20, { r: 4, stroke: s === 'Delete' ? '#a11d33' : '#333', sw: 1.5 }); P.text(cx + bw2 / 2, cy + 14, s, { size: 9, weight: 700, anchor: 'middle', fill: s === 'Delete' ? '#a11d33' : '#222' }); cx += bw2 + 5; }); cy += 26; }
        return cy + pad - y;
      });
      P.rect(x, y, w, hh, { r: 4, stroke: '#555' }); P.push(svg); return hh;
    }
    case 'paper': { // a search/library result card
      const pad = 10;
      const [hh, svg] = P.capture(() => {
        let cy = y + pad;
        const Lt = wrap(b.title, w - pad * 2, 11); Lt.forEach((l, i) => P.text(x + pad, cy + 11 + i * 14, l, { size: 11, weight: 700, underline: true })); cy += Lt.length * 14 + 3;
        if (b.authors) { P.text(x + pad, cy + 10, b.authors, { size: 10, weight: 700 }); cy += 15; }
        if (b.meta) { const Lm = wrap(b.meta, w - pad * 2, 9); Lm.forEach((l, i) => P.text(x + pad, cy + 9 + i * 11, l, { size: 9, fill: '#666' })); cy += Lm.length * 11 + 3; }
        if (b.badges) { let cx = x + pad; b.badges.forEach((s) => { const bw = s.length * 5.2 + 14; P.rect(cx, cy, bw, 15, { r: 7, stroke: '#555' }); P.text(cx + bw / 2, cy + 10.5, s, { size: 8.5, anchor: 'middle' }); cx += bw + 4; }); cy += 21; }
        if (b.abstract) { P.text(x + pad, cy + 10, '▸ Abstract', { size: 10, weight: 700 }); cy += 17; }
        if (b.doi) { P.text(x + pad, cy + 9, b.doi, { size: 9, fill: '#555' }); cy += 14; }
        if (b.found) { P.text(x + pad, cy + 9, b.found, { size: 9, fill: '#777' }); cy += 14; }
        if (b.chips) { let cx = x + pad; b.chips.forEach((s) => { const bw = s.length * 5.2 + 14; if (cx + bw > x + w - pad) { cx = x + pad; cy += 19; } P.rect(cx, cy, bw, 15, { r: 7, stroke: '#777' }); P.text(cx + bw / 2, cy + 10.5, s, { size: 8.5, anchor: 'middle' }); cx += bw + 4; }); cy += 20; }
        if (b.actions) { let cx = x + pad; cy += 2; P.line(x + pad, cy, x + w - pad, cy, { stroke: '#ccc' }); cy += 6; b.actions.forEach((s) => { const lab = s.s ?? s; const bw = lab.length * 5.9 + 18; P.rect(cx, cy, bw, 20, { r: 4, stroke: '#333', sw: 1.5 }); P.text(cx + bw / 2, cy + 14, lab, { size: 9, weight: 700, anchor: 'middle' }); cx += bw + 5; }); if (b.saved) { if (cx + 4 + b.saved.length * 5.3 > x + w - pad) { cy += 24; P.text(x + pad, cy + 14, b.saved, { size: 9, weight: 700 }); } else P.text(cx + 4, cy + 14, b.saved, { size: 9, weight: 700 }); } cy += 26; }
        return cy + pad - 4 - y;
      });
      P.rect(x, y, w, hh, { r: 4, stroke: '#555' }); P.push(svg); return hh;
    }
    case 'table': { // desktop: full table; phone: clipped to show it scrolls inside its own region
      const cols = b.head.length; const first = m ? 110 : 150; const cw = m ? 86 : (w - first) / (cols - 1); const tw = first + cw * (cols - 1);
      const rowH = 54; const hh = 24 + rowH * b.rows.length + 52;
      const clipId = `clip${Math.round(x)}${Math.round(y)}`;
      P.push(`<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${hh + 14}"/></clipPath><g clip-path="url(#${clipId})">`);
      P.rect(x, y, tw, hh, { stroke: '#555' });
      P.rect(x, y, tw, 24, { fill: '#eee', stroke: '#555' });
      b.head.forEach((s, i) => P.text(i === 0 ? x + 6 : x + first + (i - 1) * cw + 6, y + 16, s, { size: 10, weight: 700 }));
      b.rows.forEach((r, ri) => { const ry = y + 24 + ri * rowH; P.line(x, ry, x + tw, ry, { stroke: '#999' }); r.forEach((c, ci) => { const cx = ci === 0 ? x + 6 : x + first + (ci - 1) * cw + 6; if (ci === 0) { P.text(cx, ry + 16, fit(c[0], first - 12, 9.5), { size: 9.5, weight: 700, underline: true }); P.text(cx, ry + 29, fit(c[1], first - 12, 8.5), { size: 8.5, fill: '#777' }); } else if (c === '—') P.text(cx + cw / 2 - 12, ry + 30, '—', { size: 12, fill: '#777' }); else c.forEach((rel, k) => { const bw = rel.length * 5.2 + 14; P.rect(cx, ry + 6 + k * 18, bw, 15, { r: 7, stroke: '#333', sw: 1.5 }); P.text(cx + bw / 2, ry + 17 + k * 18, rel, { size: 8.5, weight: 700, anchor: 'middle' }); }); }); });
      const fy = y + 24 + rowH * b.rows.length; P.line(x, fy, x + tw, fy, { stroke: '#555', sw: 1.5 }); P.rect(x, fy, tw, 52, { fill: '#eee', stroke: '#555' });
      P.text(x + 6, fy + 18, 'All papers', { size: 10, weight: 700 });
      b.foot.forEach((c, i) => { const cx = x + first + i * cw + 6; c.forEach((s2, k) => P.text(cx, fy + 14 + k * 12, fit(s2, cw - 10, 8.5), { size: 8.5, weight: k === 2 ? 700 : 400, fill: k === 2 ? '#a11d33' : '#333' })); });
      P.line(x + first, y, x + first, y + hh, { stroke: '#555', sw: 2 });
      P.push('</g>');
      if (m) { P.text(x + w - 4, y + hh + 11, 'scrolls sideways inside its own region →', { size: 8, fill: '#777', anchor: 'end', italic: true }); return hh + 16; }
      return hh;
    }
    default: throw new Error(`unknown block ${b.t}`);
  }
}

const NAV = [['Dashboard', '#/dashboard'], ['Projects', '#/projects'], ['Discover', '#/discover'], ['Library', '#/library'], ['Evidence', '#/evidence'], ['Matrix', '#/matrix'], ['Progress', '#/progress']];

/** Render a page spec to a full SVG string. spec: { title, route, active, blocks, notes: {n: text}, phone?: blocks } */
export function renderPage(spec) {
  const DW = 720; const MW = 240; const X0 = 20; const MX = X0 + DW + 40; const TOP = 70;
  const P = new Painter();
  // ---------- desktop frame ----------
  const side = 118;
  const [dh, dsvg] = P.capture(() => {
    const pad = 16;
    let cy = TOP + 44;
    cy += stack(P, spec.blocks, X0 + side + pad, cy, DW - side - pad * 2, false);
    return cy + 20 - TOP;
  });
  P.rect(X0, TOP, DW, dh, { stroke: '#222', sw: 2 });
  P.rect(X0, TOP, side, dh, { fill: '#3b3b3b', stroke: '#222', sw: 2 });
  P.text(X0 + 12, TOP + 24, 'SE Research Hub', { size: 10.5, weight: 700, fill: '#fff' });
  NAV.forEach(([s], i) => { const on = s === spec.active; if (on) P.rect(X0 + 6, TOP + 38 + i * 26, side - 12, 22, { fill: '#666', stroke: 'none', r: 3 }); P.text(X0 + 16, TOP + 53 + i * 26, s, { size: 10, weight: on ? 700 : 400, fill: '#fff' }); });
  P.text(X0 + 12, TOP + dh - 14, 'Backup & export', { size: 9.5, fill: spec.active === 'Backup' ? '#fff' : '#ccc', weight: spec.active === 'Backup' ? 700 : 400 });
  P.line(X0 + 6, TOP + dh - 28, X0 + side - 6, TOP + dh - 28, { stroke: '#666' });
  P.rect(X0 + DW - 112, TOP + 10, 98, 22, { r: 4, stroke: '#555' }); P.text(X0 + DW - 63, TOP + 25, 'Dark theme', { size: 9.5, weight: 700, anchor: 'middle' });
  P.push(dsvg);
  if (spec.navNote) P.callout(spec.navNote, X0 + side - 4, TOP + 36);
  // ---------- phone frame ----------
  const pblocks = spec.phone ?? spec.blocks;
  const [mh, msvg] = P.capture(() => {
    const pad = 12; let cy = TOP + 38 + 8;
    cy += stack(P, pblocks, MX + pad, cy, MW - pad * 2, true);
    return cy + 48 - TOP;
  });
  P.rect(MX, TOP, MW, mh, { stroke: '#222', sw: 2, r: 10 });
  P.rect(MX, TOP, MW, 34, { fill: '#3b3b3b', stroke: '#222', sw: 2, r: 10 });
  P.text(MX + 12, TOP + 22, 'SE Research Hub', { size: 10, weight: 700, fill: '#fff' });
  P.rect(MX + MW - 78, TOP + 7, 68, 20, { r: 4, stroke: '#ddd', fill: '#3b3b3b' }); P.text(MX + MW - 44, TOP + 21, 'Dark theme', { size: 8, fill: '#fff', anchor: 'middle', weight: 700 });
  P.rect(MX, TOP + mh - 38, MW, 38, { fill: '#3b3b3b', stroke: '#222', sw: 2, r: 10 });
  ['Dashboard', 'Discover', 'Library', 'Menu'].forEach((s, i) => { const on = s === spec.active; if (on) P.rect(MX + i * 60 + 4, TOP + mh - 34, 52, 30, { fill: '#666', stroke: 'none', r: 4 }); P.text(MX + i * 60 + 30, TOP + mh - 15, s, { size: 8.5, fill: '#fff', anchor: 'middle', weight: on ? 700 : 400 }); });
  P.push(msvg);
  if (spec.navNote) P.callout(spec.navNote, MX + MW - 8, TOP + mh - 42);

  // ---------- title and legend ----------
  const H = Math.max(dh, mh);
  const head = [];
  head.push(`<text x="${X0}" y="26" font-size="18" font-weight="700" fill="#111">${esc(spec.title)}</text>`);
  head.push(`<text x="${X0}" y="44" font-size="11" fill="#555">Route ${esc(spec.route)}${spec.src ? '   ·   ' + esc(spec.src) : ''}</text>`);
  head.push(`<text x="${X0}" y="${TOP - 8}" font-size="10" font-weight="700" fill="#666">DESKTOP AND TABLET (768px and wider)</text>`);
  head.push(`<text x="${MX}" y="${TOP - 8}" font-size="10" font-weight="700" fill="#666">PHONE (320px)</text>`);
  const L = new Painter();
  let ly = TOP + H + 30;
  L.text(X0, ly, 'Annotations', { size: 12, weight: 700 }); ly += 8;
  const colW = (DW + 40 + MW) / 2 - 10;
  const entries = Object.entries(spec.notes ?? {});
  const colsY = [ly, ly];
  entries.forEach(([n, txt], i) => {
    const col = i % 2; const lines = wrap(txt, colW - 24, 10);
    const cx = X0 + col * (colW + 20); let cy = colsY[col] + 14;
    L.callout(n, cx + 8, cy - 3);
    lines.forEach((l, k) => L.text(cx + 22, cy + k * 13, l, { size: 10, fill: '#222' }));
    colsY[col] = cy + lines.length * 13 + 4;
  });
  const total = Math.max(...colsY) + 18;
  const W = MX + MW + 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${total}" viewBox="0 0 ${W} ${total}" font-family="Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#fff"/>${head.join('')}${P.out.join('')}${L.out.join('')}</svg>`;
  return svg;
}

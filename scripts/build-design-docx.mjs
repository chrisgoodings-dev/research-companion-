// Build docs/design/SE-Research-Hub-Design-Documentation.docx from the Markdown design documents.
// Diagrams become the rendered PNGs; very wide diagrams get their own landscape page.
// Run: npm run design:docx   (run `npm run design` first so the images exist)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageOrientation, ShadingType, Footer, PageNumber, ExternalHyperlink, PageBreak, LevelFormat,
} from 'docx';

const DOCS = 'docs/design';
const ORDER = [['wireframes.md', 'Wireframes'], ['site-map.md', 'Site map and navigation'], ['use-cases.md', 'Use cases'], ['data-flow.md', 'Data flow and data model'], ['threat-model.md', 'Threat model'], ['sequence-diagrams.md', 'Interaction sequence diagrams']];
const PORTRAIT = { w: 600, h: 780 };   // usable image box in pixels (A4, 1 inch margins)
const LANDSCAPE = { w: 930, h: 540 };
const FONT = 'Calibri';

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

/** Inline Markdown (bold, italic, code, links) to runs. */
function inline(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*[^*\s][^*]*\*)/g;
  let last = 0; let m;
  const push = (t, o = {}) => { if (t) runs.push(new TextRun({ text: t, font: FONT, ...base, ...o })); };
  const clean = (t) => t.replace(/<br\s*\/?>/g, ' ').replace(/\\\|/g, '|');
  while ((m = re.exec(text))) {
    push(clean(text.slice(last, m.index)));
    const tok = m[0];
    if (m[1]) push(clean(tok.slice(2, -2)), { bold: true });
    else if (m[2]) push(tok.slice(1, -1), { font: 'Consolas', size: (base.size ?? 22) - 2, shading: { type: ShadingType.CLEAR, fill: 'EEF2F3' } });
    else if (m[3]) { const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/); if (/^https?:/.test(url)) runs.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: 'Hyperlink', font: FONT, ...base })] })); else push(label); }
    else push(clean(tok.slice(1, -1)), { italics: true });
    last = m.index + tok.length;
  }
  push(clean(text.slice(last)));
  return runs;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'AAB4B8' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function table(rows) {
  const header = rows[0]; const body = rows.slice(2);
  const cols = header.length;
  const weights = header.map((_, c) => Math.min(60, Math.max(8, ...[header, ...body].map((r) => (r[c] ?? '').length))));
  const total = weights.reduce((a, b) => a + b, 0);
  const TW = 9026;
  const widths = weights.map((w) => Math.round((TW * w) / total));
  const mk = (cells, head) => new TableRow({ tableHeader: head, cantSplit: true, children: cells.map((c, i) => new TableCell({ borders, width: { size: widths[i], type: WidthType.DXA }, margins: { top: 50, bottom: 50, left: 90, right: 90 }, shading: head ? { type: ShadingType.CLEAR, fill: 'E3ECEE' } : undefined, children: [new Paragraph({ spacing: { after: 0 }, children: inline(c ?? '', { size: 18, bold: head }) })] })) });
  return new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: widths, rows: [mk(header, true), ...body.map((r) => mk(Array.from({ length: cols }, (_, i) => r[i] ?? ''), false))] });
}

const splitRow = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());

async function image(path, alt, landscapeAllowed = true) {
  const buf = await readFile(path); const { w, h } = pngSize(buf);
  const wide = landscapeAllowed && w / h > 1.9;
  const box = wide ? LANDSCAPE : PORTRAIT;
  const scale = Math.min(box.w / w, box.h / h);
  const run = new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: alt.slice(0, 80), description: alt, name: path.split('/').pop() } });
  return { para: new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, keepNext: true, children: [run] }), wide, caption: alt };
}

/** Markdown file -> list of items: {kind:'block', node} | {kind:'wide', nodes} */
async function convert(file) {
  const text = await readFile(join(DOCS, file), 'utf8');
  const lines = text.split('\n');
  const items = []; let i = 0; let para = [];
  const flush = () => { if (para.length) { items.push({ node: new Paragraph({ spacing: { after: 120 }, children: inline(para.join(' '), { size: 21 }) }) }); para = []; } };
  while (i < lines.length) {
    const line = lines[i];
    const diagram = line.match(/^<!--\s*diagram:\s*([a-z0-9-]+)\s*-->/);
    if (diagram) { flush(); const name = diagram[1]; while (!lines[i].startsWith('```mermaid')) i += 1; i += 1; while (!lines[i].startsWith('```')) i += 1; i += 1;
      const img = await image(join(DOCS, 'diagrams', `${name}.png`), name.replace(/-/g, ' '));
      items.push(img.wide ? { wide: img.para } : { node: img.para }); continue; }
    if (line.startsWith('```')) { flush(); const lang = line.slice(3).trim(); i += 1; const code = []; while (!lines[i].startsWith('```')) { code.push(lines[i]); i += 1; } i += 1; void lang;
      code.forEach((c) => items.push({ node: new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F1F4F5' }, children: [new TextRun({ text: c || ' ', font: 'Consolas', size: 17 })] }) })); items.push({ node: new Paragraph({ spacing: { after: 100 }, children: [] }) }); continue; }
    if (/^<!--.*-->$/.test(line.trim())) { i += 1; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); const lvl = h[1].length; items.push({ heading: lvl, node: new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][lvl - 1], spacing: { before: lvl === 1 ? 0 : 240, after: 100 }, keepNext: true, children: inline(h[2], { bold: true, font: FONT }) }) }); i += 1; continue; }
    const im = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (im) { flush(); const img = await image(join(DOCS, im[2]), im[1], false); items.push({ node: img.para }); items.push({ node: new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: im[1], italics: true, size: 17, font: FONT, color: '555555' })] }) }); i += 1; continue; }
    if (line.trim().startsWith('|')) { flush(); const rows = []; while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i += 1; } items.push({ node: table(rows) }); items.push({ node: new Paragraph({ spacing: { after: 140 }, children: [] }) }); continue; }
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) { flush(); const nested = li[1].length >= 2; const numbered = /\d/.test(li[2]); items.push({ node: new Paragraph({ numbering: { reference: numbered ? 'nums' : 'bullets', level: nested ? 1 : 0 }, spacing: { after: 50 }, children: inline(li[3], { size: 21 }) }) }); i += 1; continue; }
    if (!line.trim()) { flush(); i += 1; continue; }
    if (/^---+$/.test(line.trim())) { flush(); i += 1; continue; }
    para.push(line.trim()); i += 1;
  }
  flush();
  return items;
}

const page = (landscape) => ({ page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1440, right: 1440, bottom: 1300, left: 1440 } } });
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SE Research Hub: design documentation   ·   page ', size: 16, color: '666666', font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666', font: FONT })] })] });

const sections = [];
const cover = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: 'SE Research Hub', bold: true, size: 64, font: FONT, color: '0B5A54' })] }),
  new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: 'Design documentation', size: 40, font: FONT })] }),
  new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Wireframes, site map, use cases, data flow, threat model and interaction sequences', size: 24, font: FONT, color: '444444' })] }),
  new Paragraph({ spacing: { before: 800, after: 60 }, children: [new TextRun({ text: 'Module: Web Technologies (55-709700)', size: 22, font: FONT })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'Live site: ', size: 22, font: FONT }), new ExternalHyperlink({ link: 'https://chrisgoodings-dev.github.io/research-companion-/', children: [new TextRun({ text: 'https://chrisgoodings-dev.github.io/research-companion-/', style: 'Hyperlink', size: 22, font: FONT })] })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Generated: ${new Date().toISOString().slice(0, 10)}`, size: 22, font: FONT })] }),
  new Paragraph({ spacing: { before: 600, after: 120 }, children: [new TextRun({ text: 'Contents', bold: true, size: 28, font: FONT })] }),
  ...ORDER.map(([, t], k) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${k + 1}.  ${t}`, size: 24, font: FONT })] })),
  new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: 'These documents describe the application as built. The diagrams are also provided as vector (SVG) and high-resolution (PNG) files in docs/design/diagrams and docs/design/wireframes, which are easier to read at full size than the page-fitted copies in this document.', italics: true, size: 20, font: FONT, color: '555555' })] }),
];
sections.push({ properties: page(false), footers: { default: footer }, children: cover });

for (const [file] of ORDER) {
  const items = (await convert(file)).filter((it) => !(it.heading === 2 && /^Regenerating/.test(it.node?.root?.[1]?.root?.[0]?.root?.[1] ?? '')));
  let current = []; let first = true;
  const push = (landscape) => { if (current.length) sections.push({ properties: page(landscape), footers: { default: footer }, children: current }); current = []; };
  for (const it of items) {
    if (it.wide) { push(false); sections.push({ properties: page(true), footers: { default: footer }, children: [it.wide] }); first = false; continue; }
    if (first && it.heading === 1) { current.push(it.node); first = false; continue; }
    current.push(it.node); first = false;
  }
  push(false);
}

const doc = new Document({
  creator: 'SE Research Hub', title: 'SE Research Hub: design documentation', description: 'Wireframes, site map, use cases, data flow, threat model and sequence diagrams',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 40, bold: true, color: '0B5A54', font: FONT }, paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: '14262A', font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '14262A', font: FONT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '333333', font: FONT }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 } },
    ],
    characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: '0B5A54', underline: { type: 'single' } } }],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }, { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } }] },
    { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } }, { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 320 } } } }] },
  ] },
  sections,
});
const out = `${DOCS}/SE-Research-Hub-Design-Documentation.docx`;
await writeFile(out, await Packer.toBuffer(doc));
console.log(`wrote ${out} (${sections.length} sections)`);

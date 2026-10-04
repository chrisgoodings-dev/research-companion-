// Extract every ```mermaid block that follows a "<!-- diagram: name -->" comment in docs/design/*.md,
// check it parses, and render docs/design/diagrams/<name>.svg and .png (PNG at 2x for Word and slides).
// Run: npm run diagrams        Fails (exit 1) on any syntax error, so a broken diagram cannot be committed unnoticed.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const DOCS = 'docs/design';
const OUT = join(DOCS, 'diagrams');
await mkdir(OUT, { recursive: true });

const found = [];
for (const file of (await readdir(DOCS)).filter((f) => f.endsWith('.md'))) {
  const text = await readFile(join(DOCS, file), 'utf8');
  for (const m of text.matchAll(/<!--\s*diagram:\s*([a-z0-9-]+)\s*-->\s*```mermaid\n([\s\S]*?)```/g)) found.push({ file, name: m[1], code: m[2].trim() });
}
const names = found.map((d) => d.name);
const dup = names.filter((n, i) => names.indexOf(n) !== i);
if (dup.length) { console.error(`Duplicate diagram names: ${[...new Set(dup)].join(', ')}`); process.exit(1); }

const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(local) ? local : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="host"></div></body></html>');
await page.addScriptTag({ path: 'node_modules/mermaid/dist/mermaid.min.js' });
await page.evaluate(() => window.mermaid.initialize({
  startOnLoad: false, securityLevel: 'strict', theme: 'neutral',
  fontFamily: 'Arial, Helvetica, sans-serif',
  flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: false, nodeSpacing: 40, rankSpacing: 55 },
  sequence: { useMaxWidth: false, mirrorActors: false, wrap: true, width: 190, noteMargin: 8, messageMargin: 36, actorMargin: 40 },
  er: { useMaxWidth: false },
}));

let failed = 0;
for (const d of found) {
  const result = await page.evaluate(async ({ name, code }) => {
    try {
      const { svg } = await window.mermaid.render(`d-${name}`, code);
      return { svg };
    } catch (e) { return { error: String(e?.message ?? e).split('\n').slice(0, 4).join(' | ') }; }
  }, d);
  if (result.error) { failed += 1; console.error(`FAIL ${d.file} :: ${d.name}\n     ${result.error}`); continue; }
  await writeFile(join(OUT, `${d.name}.svg`), result.svg);
  await page.evaluate((svg) => { document.getElementById('host').innerHTML = svg; }, result.svg);
  await page.locator('#host svg').screenshot({ path: join(OUT, `${d.name}.png`) });
  console.log(`ok   ${d.name}`);
}
await browser.close();
console.log(failed ? `\n${failed} diagram(s) failed` : `\n${found.length} diagram(s) rendered to ${OUT}/`);
process.exit(failed ? 1 : 0);

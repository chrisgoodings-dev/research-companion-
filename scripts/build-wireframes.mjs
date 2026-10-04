// Render every wireframe page to docs/design/wireframes/<file>.svg and .png.  Run: npm run wireframes
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { renderPage } from './wireframe-lib.mjs';
import { pages } from './wireframe-pages.mjs';
import { overlays } from './wireframe-overlays.mjs';

const OUT = 'docs/design/wireframes';
await mkdir(OUT, { recursive: true });
const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(local) ? local : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();

const only = process.argv[2];
const all = [...pages.map((p) => ({ file: p.file, svg: renderPage(p) })), ...overlays()];
let n = 0;
for (const { file, svg } of all) {
  if (only && file !== only) continue;
  await writeFile(`${OUT}/${file}.svg`, svg);
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  await page.locator('svg').first().screenshot({ path: `${OUT}/${file}.png` });
  console.log(`ok   ${file}`); n += 1;
}
await browser.close();
console.log(`\n${n} wireframe(s) rendered to ${OUT}/`);

// Shared helpers for the browser tests: static server, Chromium, axe-core, pass/fail reporting.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

export async function start() {
  const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const name = path === '/' ? '/index.html' : path;
    try {
      res.writeHead(200, { 'content-type': types[extname(name)] ?? 'application/octet-stream' }).end(await readFile(join(root, name)));
    } catch { res.writeHead(404).end('not found'); }
  }).listen(0);
  const base = `http://localhost:${server.address().port}/`;
  const shots = join(root, 'docs/testing/screenshots');
  await mkdir(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  let failures = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

  async function axe(page, label) {
    await page.evaluate(axeSource);
    const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
    check(result.violations.length === 0, `axe (${label}): ${result.violations.length} violation(s)${result.violations.map((v) => `\n      - ${v.id}: ${v.help} [${v.nodes.map((n) => n.target).join(' | ')}]`).join('')}`);
  }

  async function finish() {
    await browser.close();
    server.close();
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
    process.exit(failures ? 1 : 0);
  }
  return { base, browser, check, axe, shots, finish };
}

# SE Research Hub

A research evidence workspace built for the MSc Web Technologies module (55-709700), Assessment 3.
Discover papers through scholarly APIs, save them to a project, capture structured evidence
(kept separate from your own interpretation) and relate it to research questions in an evidence matrix.

**Live site:** _add the public URL here once deployed (GitHub Pages / Cloudflare Pages)._

## Run locally
```bash
npm install
npm start            # http://localhost:8080 (static, no build step)
npm test             # unit tests (Node test runner)
npm run test:e2e     # all browser suites, HTML validation and the whole-app audit (a few minutes)
npm run audit        # 90 page audits: axe-core, keyboard-only pass, text spacing; writes docs/testing/accessibility-audit.md
npm run validate     # HTML validation of every rendered route; writes docs/testing/html-validation.md
npm run contrast     # WCAG contrast ratios for the design tokens
```

## Stack
Plain HTML, CSS and ES-module JavaScript. No framework and no build step, so it deploys as static files.
IndexedDB holds research data; localStorage holds the theme. OpenAlex and Crossref provide paper search (set `CONTACT_EMAIL` in `js/config.js`).

## Structure
```
index.html          app shell (landmarks, nav, live region, menu dialog)
css/                tokens (theme) → base → layout (mobile-first) → components
js/                 main, router (hash routes), ui helpers, views
tests/              unit, e2e (Playwright + axe-core), contrast checker
docs/               build plan, development log, test screenshots
```

## Status
See `docs/build-plan.md` for the 12-stage plan and `docs/development-log.md` for progress.

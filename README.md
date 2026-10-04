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
npm run test:e2e     # browser smoke test + axe-core accessibility scan + screenshots
npm run contrast     # WCAG contrast ratios for the design tokens
```

## Stack
Plain HTML, CSS and ES-module JavaScript. No framework and no build step, so it deploys as static files.
IndexedDB holds research data; localStorage holds the theme. Planned: OpenAlex and Crossref APIs (Stages 4-5).

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

# Test results

Run on the final build (see `docs/development-log.md` for the history of failures found and fixed at each stage).

| Layer | Command | Result |
|---|---|---|
| Unit tests (Node test runner, fake IndexedDB): validation, repository and cascades, API clients, merge, backup/restore and CSV, library/evidence/matrix/progress logic, router | `npm test` | **113 passed, 0 failed** |
| Colour contrast (WCAG 1.4.3 / 1.4.11) for every token pair, light and dark | `npm run contrast` | **43 passed**, 2 deliberately rejected pairs fail as expected |
| Browser suites (Playwright + Chromium + axe-core): navigation, projects, discover, save, library, evidence, matrix, backup, polish, sub-path hosting | `npm run test:e2e` | **484 checks passed, 0 failed** (12 suites) |
| HTML validation of 14 rendered routes | `npm run validate` | 0 problems |
| Whole-app audit: 90 audits (axe incl. best-practice, keyboard-only, text spacing, focus not obscured) | `npm run audit` | **0 failures** |
| Lighthouse (4 pages, mobile profile) | see `lighthouse.md` | Accessibility 100, Best practices 100, SEO 100, Performance 98-99 |

## Testing approach
- **Test the risky parts hardest**: untrusted input (API data, backup files), data integrity (cascades, atomic import) and accessibility each have dedicated tests, several **mutation-checked** (the protection was removed and the suite shown to fail).
- **Mocked APIs**: the browser tests replace OpenAlex and Crossref with recorded sample responses (`tests/fixtures/`), so they never depend on third-party uptime and can simulate rate limits, outages, empty results and hostile data. **Live API behaviour is the one thing not verified here**; see the acceptance checklist in `docs/deployment.md`.
- **Not covered**: manual screen-reader testing, real-device testing and browsers other than Chromium. Say so in the write-up.

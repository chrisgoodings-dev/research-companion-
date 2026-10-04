# SE Research Hub: Build Plan (reconciled with the assessment brief)

Status: draft built from the assessment brief and the ChatGPT export. I have NOT seen
`SE_Research_Hub_Development_Plan.md` v2.0, `requirements-traceability.md` or the v2 test strategy.
Where this plan disagrees with them, treat those documents as the source of truth and reconcile.

## 1. What is being assessed
- 45% of the module. A 1,000-word (±10%) Word evaluation of the Assignment 2 web app, due **15:00, Tue 20 Oct 2026**.
- Needs: overview + **public URL**; up to 5 CSS items; up to 5 HTML form items; up to 5 accessibility examples tied to W3C/WCAG; AITS declaration appendix.
- The marker opens the live site and checks it against your claims. The app must be deployed, working and consistent with the write-up.
- Top-band criteria: alternatives discussed in depth, mobile-first, selectors/classes, form types/attributes/validation, WCAG references.

## 2. Decisions already made (from the export)
| Area | Decision |
|---|---|
| Concept | Research evidence workspace: discover (APIs) → save → review → extract evidence → relate to research question → synthesise |
| Data | External scholarly APIs only; no own paper database; at least two complementary APIs |
| Storage | IndexedDB for research data (projects, researchQuestions, papers, projectPapers, evidenceNotes); localStorage for theme |
| Evidence model | Evidence kept separate from interpretation; relationship = Supports / Contradicts / Mixed / Contextual / No evidence; page/section; tags |
| Synthesis | Evidence Matrix (papers × research questions); promoted to Must |
| Portability | JSON backup/restore, CSV export |
| Out of scope | Accounts, cloud sync, collaboration, PDF reader/highlighting, AI summaries, auto-classification, Zotero replacement |
| Visual | "Teal Graphite"; persistent left sidebar on desktop; bottom nav on mobile |
| Nav | Desktop: Dashboard, Projects, Discover, Library, Evidence, Matrix, Progress. Mobile: Dashboard, Discover, Library, Menu |
| Paper detail | Tabs: Overview / Review / Evidence |
| Hosting | GitHub + Cloudflare |
| Repo | `D:\Projects\se-research-hub`, `main`, docs scaffold already committed |

## 3. Issues to resolve before coding
1. **Scope vs time.** The brief expects ~10 hours and only 5 items per category are written up. The planned app is large. Use a hard MoSCoW cut line (section 6) and a code freeze on **Wed 14 Oct**, leaving five days for the write-up.
2. **API choice must work from a static site** (no backend, so browser CORS applies).
   - Primary: **OpenAlex** (CORS-enabled, no key, add `mailto=` for the polite pool). Abstracts come as an *inverted index*, so write a small `reconstructAbstract()` helper (good evidence of real JS work).
   - Secondary: **Crossref** (CORS-enabled, DOI/metadata; abstracts are sometimes JATS XML, so strip tags).
   - Optional: Semantic Scholar (rate-limited). **Avoid arXiv and CORE** unless you add a proxy (XML/CORS/key problems).
   - Add a merge/de-duplicate step by DOI. Handle rate limits, empty results and network failure with visible, accessible messages.
3. **Palette contrast.** Primary Teal `#14B8A6` on white is roughly 2.5:1 and fails WCAG 1.4.3 for text. Use it for accents on dark surfaces only; use a darker teal (e.g. `#0F766E`, verify) for text and buttons on light surfaces. Verify every pair with a contrast checker and record the ratios (these become write-up evidence).
4. **Relationship states must not rely on colour alone** (WCAG 1.4.1). Pair colour with an icon and text label.
5. **AI declaration.** Pick the AITS level your module allows and log AI assistance in `docs/assessment/development-log.md` from now on, so the appendix is accurate. The written evaluation itself must be your own work.
6. **Environment.** Your repo is on a local Windows drive; this cloud session has no repo. Either build locally with the steps below, or start a session with the repo connected on GitHub.

## 4. Technical approach
- Vanilla HTML/CSS/JS with **ES modules, no framework and no build step**, so it deploys as static files and keeps the CSS/forms/accessibility discussion in your own code.
- Hash-based router (`#/discover`, `#/library`, ...) so static hosting needs no rewrite rules.
- Thin IndexedDB wrapper (promise-based, one store per entity) behind a `storage.js` module; the UI never touches IndexedDB directly.
- Suggested structure:

```
index.html
css/  tokens.css  base.css  layout.css  components.css  utilities.css
js/   main.js  router.js  state.js
      api/    openalex.js  crossref.js  normalise.js  dedupe.js
      db/     db.js  projects.js  papers.js  evidence.js
      views/  dashboard.js  projects.js  discover.js  library.js  paper.js  evidence.js  matrix.js  progress.js
      ui/     toast.js  dialog.js  announcer.js
      io/     exportJson.js  importJson.js  exportCsv.js
tests/        unit tests for normalise, reconstructAbstract, dedupe, db, import validation
docs/         (existing)
```

- Unit tests run with Node's built-in test runner on pure modules (normalise, dedupe, import validation); manual and Lighthouse/axe checks cover the rest, matching your test strategy.

## 5. Staged plan (each stage works and is committed before the next)
| # | Stage | Acceptance check | Write-up payoff |
|---|---|---|---|
| 0 | **Deploy skeleton**: semantic `index.html`, empty shell, push, connect Cloudflare/GitHub Pages | Public URL loads over HTTPS | URL secured early |
| 1 | **Design tokens + shell**: CSS custom properties, Grid app shell, sidebar → bottom nav, skip link, landmarks, theme toggle | Works at 320px and 1440px; keyboard nav; contrast table recorded | CSS #1–3, A11y #1–2 |
| 2 | **Router + views stubs + dashboard with sample data** | All nav items reachable, focus moves to `<h1>` on route change | A11y #3 |
| 3 | **IndexedDB layer + Projects & Research Questions** (create/edit/delete forms) | Data survives reload; validation messages announced | Forms #1–3 |
| 4 | **Discover: search form + OpenAlex** → normalised results, loading/empty/error states | Real results; `aria-live` status; filters (year range, open access, sort) | Forms #4–5, API discussion |
| 5 | **Crossref + merge/de-dupe**; Save to Project | Duplicates merged by DOI; saved papers persist | Overview "unique features" |
| 6 | **Library + Paper detail** (Overview / Review tabs, structured review fields) | Tabs keyboard-operable (arrow keys, ARIA tab pattern or simpler disclosure) | A11y #4 |
| 7 | **Evidence records** (RQ select, relationship radio group, evidence vs interpretation textareas, page/section, tags) | Multiple records per paper; edit/delete; relationship has text + icon | Forms deep-dive |
| 8 | **Evidence Matrix** (accessible `<table>` with `scope`, per-cell relationship + count, click through to evidence) | Screen-reader readable; scrolls on mobile without breaking layout | A11y #5, CSS table/responsive |
| 9 | **Export/Import**: JSON backup/restore (validated), CSV | Round-trip restore gives identical data; bad file rejected with message | Forms (`type=file`) |
| 10 | **Progress view, polish, reduced-motion, print/empty states** | No console errors | CSS extras |
| 11 | **Audit & fix**: Lighthouse, axe/WAVE, keyboard-only pass, 200% zoom, mobile device test, HTML validator | Accessibility ≥ 95; no critical axe issues; log results | Evidence for the write-up |
| 12 | **Freeze (Wed 14 Oct) → write-up**; screenshots, final URL check | Submit by Mon 19 Oct (buffer) | The assessed document |

### Cut line
- **Must:** stages 0–4, 5 (can drop Crossref if time-poor), 6, 7, 8, 9 (JSON only), 11.
- **Should:** Crossref merge, CSV, Progress view.
- **Could:** extra filters, saved searches, theme polish.
If you are behind at the end of the weekend of 10–11 Oct, drop the *Could* items and Progress.

## 6. Timeline (today is Sun 4 Oct)
| Dates | Stages |
|---|---|
| 4–5 Oct | 0–2 |
| 6–8 Oct | 3–4 |
| 9–11 Oct | 5–7 |
| 12–13 Oct | 8–9 |
| 14 Oct | 10–11, then freeze |
| 15–19 Oct | Write-up, proofread, declaration, submit |
| 20 Oct 15:00 | Deadline |

## 7. Pre-planned write-up evidence (pick the best 5 per category)
**CSS candidates**
1. Custom properties for the Teal Graphite tokens and theme switch (alt: Sass variables, hard-coded values).
2. Mobile-first `min-width` breakpoints with CSS Grid app shell (alt: Flexbox, desktop-first `max-width`, framework such as Bootstrap).
3. Class-based component selectors and low specificity (BEM-style naming; alt: IDs, utility classes like Tailwind).
4. `:focus-visible`, `prefers-reduced-motion`, `prefers-color-scheme` (alt: `:focus`, JS-only toggles).
5. Fluid sizing with `clamp()`/`rem` (alt: fixed `px`, media-query steps).

**HTML forms candidates**
1. `input type="search"` with a `<label>`, `enterkeyhint`, `autocomplete="off"` (alt: `type="text"`).
2. `fieldset`/`legend` + **radio group** for the 5 relationship values (alt: `<select>`: weaker visibility; checkboxes: allow invalid multi-select).
3. `<textarea>` with `maxlength` and character guidance for evidence/interpretation (alt: `contenteditable`).
4. `type="number"`/range inputs for years, `<select>` for sort, checkbox for open-access (alt: sliders, custom widgets).
5. Validation: `required`, `pattern` for DOI, `type="url"`, plus the Constraint Validation API with custom messages; `type="file"` with `accept` for import (alt: server-side-only validation; drag-and-drop only).

**Accessibility candidates (each with a WCAG reference)**
1. Skip link + landmarks (2.4.1, 1.3.1).
2. Labels, instructions and errors with `aria-describedby` / `aria-live` (3.3.1, 3.3.2, 4.1.3).
3. Contrast and non-colour cues for relationship states (1.4.3, 1.4.1).
4. Full keyboard operability and visible focus, including tabs and dialogs (2.1.1, 2.4.7).
5. Responsive reflow and zoom, plus accessible matrix table with `scope` (1.4.10, 1.3.1).

## 8. Housekeeping
- Commit after every stage with a clear message; update `development-log.md` and `requirements-traceability.md` as you go.
- Keep screenshots of tests and audit results in `docs/testing/`; these feed the write-up and the evidence trail.
- Record the final public URL in `README.md`.

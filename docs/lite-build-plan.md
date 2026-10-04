# SE Research Hub Lite: a 20-hour build plan

Status: plan only, nothing built yet. Written after reading all three assessment briefs and reviewing the full app.

## 1. Why a smaller version

Assessment 2 (50%) is described as "around 10 hours" and its own example is a film list with a detail page. The current app is about 200-290 hours of work: 40 JavaScript files, 3,200 lines of app JavaScript, 3,300 lines of tests, and a CSP, a backup validator and a 90-page audit. A marker will not find that credible as a 10-20 hour project, and the author cannot realistically explain all of it.

**Over-engineering found in the current code**

| Area | Current | Why it is more than the brief needs |
|---|---|---|
| Data layer | IndexedDB, 5 stores, 290-line repository, cascade deletes, transactions | `localStorage` holds a reading list perfectly well |
| Domain model | Projects, research questions, papers, projectPapers, evidence | One list of saved papers, each with one note |
| Routing | Hash router, lazy `import()`, retry logic (87 lines) | Separate HTML pages with real links are simpler, and the brief explicitly marks "links, lists, titles" |
| APIs | OpenAlex + Crossref, DOI merge, de-duplication | One API with **two or three endpoints** earns the "how much use of APIs" marks |
| Views | Dashboard, Projects, Discover, Library, Evidence, Matrix, Progress, Backup | Three pages |
| Safety | CSP, strict backup validator, formula-injection guard, untrusted-data whitelist | Escape output with `textContent`; no backup feature |
| Tests/audits | 113 unit, 12 browser suites, 90-page audit, contrast script | axe/Lighthouse by hand plus a few unit tests |
| Docs | Design docs, threat model, wireframes, evidence packs | A README and a short development log |

## 2. What the briefs require (and where Lite earns it)

Assessment 2 criteria, then how the Lite app covers each:

| Criterion | Requirement from the brief | Lite coverage |
|---|---|---|
| HTML quality | Modern semantic elements, links, lists, titles | `header`, `nav`, `main`, `section`, `article`, `footer`; `<ul>` of results; a `<title>` per page; real `<a>` navigation |
| CSS quality | External files, **mobile first**, selectors: HTML, classes, **IDs**, pseudo-classes, **attribute** selectors; own CSS | One `styles.css`; `min-width` queries; `#search-form`, `.card`, `:hover`, `:focus-visible`, `:checked`, `[aria-current="page"]`, `[type="search"]` |
| JavaScript | Interaction: menu, validation, UX features | Menu toggle, form validation, fetch with states, live saving |
| HTML forms | **Range** of form elements, appropriate to the data | `search`, `number`, `select`, `checkbox`, `radio` group in `fieldset`, `textarea`, `text` |
| API | Form input calls a third-party API; **marks for how much use** | OpenAlex **search** and **get-by-ID** (plus abstract reconstruction) |
| UI/UX/accessibility | Pleasant, suited to topic, W3C accessibility | WCAG 2.2 AA basics: skip link, labels, errors, contrast, focus, reflow |
| Submission | Public URL **and** a ZIP of all files | GitHub Pages + `git archive` ZIP |
| Plagiarism | Cite any borrowed code in a comment | Cite sources in comments (see section 7) |

Assessment 3 write-up (up to 5 CSS, 5 forms, 5 accessibility examples) maps directly onto the same choices; see section 8.

## 3. The Lite app

**Name:** SE Research Hub Lite (or keep the name; the user decides).
**Purpose:** find research papers, read their details, save the ones you want, and record what each paper says as evidence (kept separate from your own interpretation) against a research question.

Three pages, one shared `styles.css`, one shared `site.js`:

| Page | Content | API / storage |
|---|---|---|
| `index.html` Search | Search form (keyword, year-from, sort, open-access only); result list; loading, empty and error states | OpenAlex `works?search=` |
| `paper.html?id=W...` Paper | Title, authors, year, venue, **abstract** (rebuilt from OpenAlex's inverted index), links, "Save to reading list" with a status select | OpenAlex `works/{id}` |
| `list.html` Reading list | Saved papers, status filter, per-paper note form (relationship radio, evidence, interpretation), delete | `localStorage` |

One research question is a single text field at the top of the reading list. No projects, matrix, progress, backup or CSV.

**Distinctive idea kept:** evidence and interpretation are separate fields, with a Supports / Contradicts / Mixed / Contextual / No evidence relationship.

## 4. File structure (target about 900 lines)

```
index.html        ~70 lines
paper.html        ~50
list.html         ~70
css/styles.css    ~350
js/api.js         ~90   search, getPaper, rebuildAbstract
js/storage.js     ~50   load/save/add/remove/update on one localStorage key
js/forms.js       ~70   validate(form) with Constraint Validation + messages
js/site.js        ~40   menu toggle, announcer, shared helpers
js/search-page.js ~90
js/paper-page.js  ~60
js/list-page.js   ~110
README.md, docs/development-log.md (short)
```

No framework, no build step, no `node_modules` in the ZIP.

## 5. Hour budget (20 h)

| # | Task | Hours | Done when |
|---|---|---|---|
| 1 | Setup, three semantic HTML pages, nav, skip link, titles | 2 | pages link together, validate at validator.w3.org |
| 2 | CSS: tokens, mobile-first layout, cards grid, forms, focus, dark mode via `prefers-color-scheme` | 5 | looks right at 320, 768 and 1280px |
| 3 | OpenAlex search: form, fetch, result list, loading/empty/error | 4 | real results on the live site |
| 4 | Paper page: get-by-ID, abstract rebuild, save button | 2 | detail page works from a result link |
| 5 | Reading list: storage, status filter, note form, delete | 3 | data survives reload |
| 6 | Validation, menu toggle, live-region announcements | 1.5 | errors announced, menu works by keyboard |
| 7 | Accessibility pass: axe, Lighthouse, keyboard-only, 200% zoom, a screen reader if possible | 1.5 | no axe violations; notes recorded |
| 8 | Deploy, README, ZIP, development log, citations in comments | 1 | public URL works; ZIP opens and runs |
| | **Total** | **20** | |

Optional only if hours remain: three small unit tests with `node:test` for `rebuildAbstract` and `storage`.

## 6. What to reuse from the current app (as reference, not copied wholesale)

- Colour tokens and the contrast result (`#0F766E` for text/buttons; teal `#14B8A6` fails on white).
- `reconstructAbstract` logic and the OpenAlex field mapping (about 40 lines after simplifying).
- Form validation messages and the `aria-describedby` / `aria-invalid` pattern.
- The focus-not-obscured fix only if the bottom nav is kept. Simplest: use a top nav and avoid the problem.

Everything else is discarded.

## 7. Risks and checks

- **CORS and rate limits:** OpenAlex allows browser requests; add the contact email as `mailto=` to use the polite pool. The user reports search works on the live site.
- **Untrusted API text:** use `textContent`, never `innerHTML`, for API data; strip tags from abstracts. This is one rule, not a security layer.
- **Citations in code:** the brief requires a comment for any borrowed algorithm or sample (for example the inverted-index abstract approach from OpenAlex's documentation). Add them as you write.
- **AI use:** the user reports the module leader permits AI for the app, discussions and evaluation. Get it in writing, then declare accurately in the Assessment 3 appendix.
- **Scope creep:** anything not in section 3 goes on a "future work" list in the README, not the code.

## 8. Effect on the Assessment 3 write-up

The written evaluation must describe the **submitted** app. The existing draft in `private/` describes the full app (IndexedDB, Crossref merge, 484 browser checks, matrix). After the Lite build it needs these changes:

- Overview: new scope, URL and limits.
- Remove claims about IndexedDB, Crossref, the matrix, test counts and the 43-pair contrast script.
- Keep the five CSS items (tokens, mobile-first, grid, selectors, `clamp()`), the five forms items (search, number, radio, textarea, validation) and the five accessibility items (skip link/landmarks, errors, colour, keyboard, reflow), but re-check each against the new code.
- Re-verify every factual claim in the draft before submitting.

## 9. Migration plan

1. Tag the current app: `git tag full-app-v1` and keep it on GitHub as a record of the earlier build.
2. Create a branch `lite` and delete the full app from it (`js/`, `css/`, `tests/`, `scripts/`, `docs/design`, `docs/testing`), then build Lite from scratch.
3. Point GitHub Pages at the same repo so the public URL does not change; update `.github/workflows/pages.yml` to deploy the Lite files only, with no test job.
4. Merge `lite` into `main` when it passes the section 5 checks.
5. Build the ZIP with `git archive --format=zip -o submission.zip HEAD`.

## 10. Decisions to confirm before building

1. **Multi-page HTML (recommended) or a single-page app?** Multi-page matches the brief's "links" wording and is simpler.
2. **`localStorage` (recommended) or IndexedDB** for the reading list.
3. **Keep the name "SE Research Hub"**, or rename it to reflect the smaller scope.
4. **Replace `main`** (recommended, tag kept) or publish Lite at a separate URL.

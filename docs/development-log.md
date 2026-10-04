# Development Log

## 2026-10-04: Stage 5 (Crossref, merge by DOI, save to project)
- Second source: `js/api/crossref.js`, normalised into the same Paper shape as OpenAlex. Crossref abstracts are JATS XML, so tags become spaces (otherwise "Abstract" glued onto the first word: caught by a unit test), entities are decoded, and the "Abstract" label is dropped.
- `js/api/merge.js`: de-duplicates by DOI (fallback: normalised title + year). The preferred source wins field conflicts; gaps are filled from the other (for example OpenAlex's open-access flag plus Crossref's longer abstract). Relevance sort interleaves by rank; newest / most-cited re-sort the merged page.
- `js/api/search.js` queries both in parallel. One source failing gives partial results plus a visible notice; a failure that would look like "no results" is reported as an error instead. Crossref has no open-access flag, so it is skipped (with a notice) when "Open access only" is on.
- Form additions: a "Sources" checkbox group (`name="d-src"` with several values, read with `FormData.getAll`) with a "choose at least one" rule.
- Saving: papers are stored once and linked to projects (`projectPapers`, id `projectId:paperId`, so duplicates are impossible). Native `<dialog>` project picker, last-used project remembered in localStorage. Removing a paper deletes only that project's evidence about it; papers nothing references are pruned. Every paper passes a field whitelist (`validatePaper`) before it reaches the database, which will also protect JSON import.
- Accessibility: the save button's accessible name includes the paper title; saved state is text ("Saved to: ..."), not colour; focus returns sensibly after cancel/save/remove.
- Test lesson: stale toasts from earlier steps made a `.first()` assertion look at the wrong element. Assertions now match on text.

## 2026-10-04: Stage 4 (Discover: OpenAlex search)
- `js/api/openalex.js`: pure `buildSearchUrl`, `reconstructAbstract` (OpenAlex ships abstracts as an inverted index), `normaliseWork`, and `searchOpenAlex` with timeout, cancellation and typed errors (network / timeout / rate-limit / server / bad-response). Everything is normalised into one app-level Paper shape (`js/api/paper.js`) so Crossref (Stage 5) can plug in.
- Discover form: `type="search"`, two `type="number"` year inputs (min/max/step), `<select>` for sort, checkbox for open access, grouped in a `<fieldset>` with a `<legend>`; cross-field rule (earliest <= latest year).
- The whole search lives in the URL (`#/discover?q=...&from=...`), so Back/reload/shareable links work. Search updates the URL with `history.pushState` and runs in place, so the form is not re-rendered or focus lost.
- States: idle, loading (`aria-busy`, announced), results, empty, error with specific messages and a Try again button. A newer search aborts and supersedes an older one.
- Security: API data is untrusted. Titles have tags stripped, every value is HTML-escaped on render, and links are limited to http(s) (blocks `javascript:`). Verified by mutation testing: removing either protection makes the tests fail.
- Bugs found by testing: (1) long unbroken strings overflowed a 320px screen (WCAG 1.4.10) -> `overflow-wrap: anywhere` on cards; (2) my own test server crashed on a missing file, which hid a failing check.
- The live OpenAlex API is blocked in the build container, so tests use fixtures written from OpenAlex's documented schema. **To do: check live results once in a normal browser** and set `OPENALEX_MAILTO` in `js/config.js`.

## 2026-10-04: Stage 3 (IndexedDB, projects, research questions)
- IndexedDB schema v1 created up front for all five planned stores (projects, researchQuestions, papers, projectPapers, evidenceNotes) with indexes, so later stages need no migration.
- All data access goes through a repository (`js/db/repository.js`); views never touch IndexedDB. Deleting a project, or a question, cascades in a single transaction.
- Validation exists in two layers: accessible form validation for users (`js/ui/forms.js`) and a pure data-layer check (`js/validation.js`) that also protects future JSON imports.
- Forms: real `<label>`s, hints and error messages wired with `aria-describedby`; `aria-invalid`; focus moves to the first invalid field; errors announced; errors use text + icon, not colour alone (WCAG 1.4.1). `novalidate` with the Constraint Validation API attributes (`required`, `minlength`, `maxlength`) kept in the markup. Whitespace-only input is rejected (native `required` would accept it).
- Destructive actions use a native `<dialog>` that focuses Cancel first; Esc cancels.
- Router now supports params (`#/projects/:id`) and async views, with a guard so a slow view cannot overwrite a newer one.
- Testing: 17 unit tests (validation, repository against fake-indexeddb, router), two browser suites with axe-core (0 violations on list, detail, editing, confirm dialog, mobile).
- Design fix from reviewing screenshots: toasts moved to the top of the screen because at the bottom they covered the form's submit button.

## 2026-10-04: Stages 0-2 (shell, tokens, routing)
- Built the semantic app shell: skip link, banner/nav/main landmarks, polite live region, `<dialog>` menu sheet.
- Mobile-first CSS in four layers (tokens, base, layout, components). Bottom nav on mobile, persistent sidebar from 48rem.
- Light/dark theme via custom properties; `data-theme` plus `prefers-color-scheme`; choice saved in localStorage.
- Hash router: focus moves to the page `<h1>` and the change is announced on navigation.
- Bug found by testing: the skip link's `#main` fragment was read by the router as an unknown page. Router now only handles `#/...` hashes and the skip link focuses `<main>` directly.
- Contrast: Teal `#14B8A6` fails as text/button on light surfaces (about 2.3-2.5:1), so `#0F766E` (5.1-5.5:1) is used there. Evidence in `npm run contrast`.
- Verified: unit tests, axe-core (WCAG 2.0-2.2 A/AA) = 0 violations on desktop light/dark, 320px mobile and open menu; no horizontal scroll at 320px or 200% font size.

### AI use (for the AITS declaration)
- AI assistant (Claude) generated the initial scaffold, tests and plan under my direction. Record here what I reviewed, changed and wrote myself.

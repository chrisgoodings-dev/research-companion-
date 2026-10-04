# Evidence pack for the written evaluation

**This is a fact sheet, not the essay.** The brief asks for *your* critical evaluation (1,000 words ±10%, up to five items each for CSS, HTML forms and accessibility, a public URL, and an AI transparency declaration). Choose the items you can discuss in your own words, and use this to check the details and find evidence. Everything below was verified against the code and tests in this repository.

Marking descriptors reward: a clear **why this element**, **alternatives and their limits**, and (accessibility) **links to W3C guidance**. The strongest items below are the ones where a real alternative exists and where a decision visibly shaped the app.

---

## 1. Overview facts (accurate description, features, use cases)

**Purpose.** SE Research Hub is a research evidence workspace for a literature review. It joins *finding papers* to *synthesising what they say*: you search two scholarly APIs, save papers to a project, review them with structured fields, record **evidence** (what a paper reports) separately from your **interpretation**, tie each record to a **research question** with a relationship (Supports, Contradicts, Mixed, Contextual, No evidence), and then see all of it in an **evidence matrix** that shows where papers agree, conflict or leave gaps.

**What it does (all working and tested).**
| Area | Behaviour |
|---|---|
| Projects and questions | Create, edit, delete projects; add numbered research questions (RQ1, RQ2…). |
| Discover | Search **OpenAlex** and **Crossref** in parallel; filters for year range, open access, sort; results merged and de-duplicated by DOI; one source failing does not lose the other's results; search state lives in the URL. |
| Library | Every saved paper across projects; keyword, project and reading-status filters; four sorts. |
| Paper detail | Overview, Review (status + six structured fields, one review per project) and Evidence tabs. |
| Evidence | Add, edit, delete records; filter across all projects; per-question counts. |
| Matrix | Papers × research questions with relationship badges, conflict flags and gap callouts, drill-down to the underlying evidence. |
| Progress | Reading progress, evidence coverage per question, written "what to do next". |
| Backup & export | JSON backup and validated restore (merge or replace), CSV exports of evidence, papers/reviews and the matrix. |

**What makes it distinctive (for "unique features").**
- Evidence and interpretation are separate fields and separately labelled blocks everywhere, so a reader can always tell reporting from inference.
- The matrix states conflicts and gaps in plain sentences as well as in the grid.
- No accounts, no server, no tracking: data stays in the browser (IndexedDB) and can be exported.
- Every status (relationship, saved, conflict, error) is carried by text and a symbol, never colour alone.

**Potential use cases.** An MSc dissertation literature review (the stated origin); a scoping or systematic review by one researcher; a reading group comparing studies against shared questions (via backup/restore files); teaching how to separate evidence from interpretation.

**Technology.** Plain HTML, CSS and ES-module JavaScript. **No framework, no build step**; about 4,000 lines in `index.html`, `css/` and `js/`. Hash-based routing (works on any static host). Routes load their code on demand with dynamic `import()`.

**Honest limits to mention.** Data is per browser and per device (no sync); search depends on two third-party APIs; the live APIs could not be reached from the build environment, so search was tested against recorded sample responses (check once on the live site: `docs/deployment.md`).

**Public URL.** https://chrisgoodings-dev.github.io/research-companion-/  (opens on the dashboard; also reachable as `https://chrisgoodings-dev.github.io/research-companion-/#/dashboard`)

---

## 2. CSS candidates (pick up to five)

For each: where it is, why, the alternatives, and how it was applied (classes, selectors).

1. **Custom properties as design tokens, with a light/dark theme.**
   *Where:* `css/tokens.css` (`:root`, `:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark)` for `data-theme="auto"`).
   *Why:* one source of truth for colour; the theme switches by changing a few values; every colour pair is checked by `npm run contrast` (43 pairs).
   *Alternatives:* Sass/Less variables (compile-time only, cannot switch at runtime), hard-coded values (repetition, easy to miss a dark-mode pair), a separate dark stylesheet.
   *Concept link:* the cascade and inheritance; theme stored in `localStorage` and applied before first paint to avoid a flash.

2. **Mobile-first layout with `min-width` media queries.**
   *Where:* `css/layout.css`: base rules are the phone layout (top bar, fixed bottom navigation); `@media (min-width: 48rem)` adds the persistent sidebar and two-column areas.
   *Why:* the smallest screen gets the simplest layout and larger screens add to it, so nothing needs undoing; it matches how the content is prioritised.
   *Alternatives:* desktop-first with `max-width` queries (must override more), a separate mobile site, a framework grid (extra weight, less control).
   *Detail worth citing:* breakpoints are in `rem`, so they follow the user's font-size setting.

3. **CSS Grid for intrinsic, query-free responsiveness.**
   *Where:* `.card-grid` in `css/layout.css` uses `repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr))`; `.two-col` adds a second column from `64rem`.
   *Why:* columns appear as space allows without per-breakpoint rules. *Alternatives:* Flexbox with wrap (less control over equal columns), floats or tables (legacy), many media queries.
   *Real bug it exposed (good critical material):* a one-column grid sized to its widest child, so a long file chooser or a third tab pushed the page past 320px. Fix: `grid-template-columns: minmax(0, 1fr)` on `.app`, `.form`, `.field` and `.stack`. A test failed three times for this same root cause before it was fixed at the source.

4. **Class selectors with low specificity, plus attribute selectors that follow accessibility state.**
   *Where:* `css/components.css`. Components use BEM-style classes (`.card`, `.field__error`, `.tabs__tab`); state is styled from ARIA attributes: `[aria-invalid="true"]`, `[aria-selected="true"]`, `[aria-current="page"]`.
   *Why:* styling cannot drift from the state assistive technology announces, and specificity stays flat and predictable.
   *Alternatives:* ID selectors (too specific), utility classes such as Tailwind (markup noise, build step), JavaScript-toggled classes (can disagree with the ARIA state), inline styles.

5. **`:focus-visible`, `prefers-reduced-motion` and `forced-colors` media features.**
   *Where:* `css/base.css` (focus ring, reduced motion), `css/components.css` (forced colours), `css/print.css` (print).
   *Why:* a consistent 3px focus ring for keyboard users only; motion off when asked; system colours in Windows High Contrast; a clean printout of the matrix.
   *Alternatives:* `:focus` (rings on mouse clicks), removing outlines (fails WCAG 2.4.7), JavaScript detection.

6. **Fluid type with `clamp()` and `rem`.** `--fs-lg`/`--fs-xl` in `css/tokens.css`: `clamp(1.5rem, 1.2rem + 1.4vw, 2.125rem)`. Scales smoothly yet keeps a `rem` floor so browser zoom still works. *Alternatives:* fixed `px`, stepped media queries, `vw` alone (ignores zoom).

7. **A scrollable table with sticky first column.** `.table-scroll` and `.matrix`. Keeps row names visible while the grid scrolls on a phone. *Alternatives:* restack each row as a card on mobile (loses the matrix comparison), a JavaScript table library. *Subtle bug:* absolutely positioned `.visually-hidden` spans inside the scroll area escaped its clipping and widened the whole page; fixed with `position: relative` on `.table-scroll`.

*(Also available: `.visually-hidden` for screen-reader text; the print stylesheet; `scroll-padding` and the focus guard for the fixed bottom bar.)*

---

## 3. HTML forms candidates (pick up to five)

Common to all: `<label for>`, a hint paragraph and an error paragraph wired by `aria-describedby`; `novalidate` on the form with the Constraint Validation attributes (`required`, `minlength`, `maxlength`, `min`, `max`) kept in the markup; custom, specific messages; focus moves to the first invalid field and the problem is announced. See `js/ui/fields.js` and `js/ui/forms.js`.

1. **`<input type="search">`** (Discover keyword, Library and Evidence filters). `enterkeyhint="search"`, `maxlength`, `autocomplete="off"`, inside `role="search"`. *Alternatives:* `type="text"` (no search semantics or clear button), `contenteditable` (no form semantics).
2. **`<input type="number">` with `min`, `max`, `step`, `inputmode`** for years. *Alternatives:* a `<select>` of years (long list), `type="range"` (imprecise, awkward for two bounds), `type="text"` with `pattern` (no numeric keyboard or spinner). Includes a **cross-field rule** (earliest ≤ latest) the attributes cannot express, and `rangeUnderflow` handling.
3. **Radio groups in `<fieldset>`/`<legend>`** for the relationship (five options, each with a one-line definition, **nothing pre-selected**) and reading status (three). *Alternatives:* `<select>` (hides the definitions and the options), checkboxes (permit invalid multiple choices), a custom segmented control (must rebuild the radio keyboard behaviour).
4. **Checkboxes**: a single boolean ("Open access only") and a **group sharing one name** for sources, read back with `FormData.getAll`. *Alternatives:* `<select multiple>` (poor usability), a toggle switch (`role="switch"`, extra ARIA), two separate controls.
5. **`<textarea>`** with `maxlength`, a live character counter and trimmed validation (whitespace-only is rejected, which native `required` would accept). *Alternatives:* `<input type="text">` (single line), `contenteditable` or a rich-text editor (accessibility and security cost).
6. **`<select required>`** for the research question (placeholder first option) and `<optgroup>` in the Evidence filter. *Alternatives:* radio list (too long), `<datalist>` (free text, inconsistent screen-reader support), a custom listbox.
7. **`<input type="file" accept=".json">`** for restore, with size and content validation before anything is changed. *Alternatives:* drag-and-drop only (keyboard-inaccessible), pasting JSON into a textarea (error-prone).
8. **Tags as a single comma-separated `<input type="text">`** parsed to a normalised list. *Alternative:* a chip widget (custom keyboard handling, more ARIA); chosen for simplicity and robustness.
9. **`<dialog>` with `method="dialog"` forms** for confirmations and "save to project" (focus trap, Esc, and focus return come from the browser). *Alternatives:* a custom modal `div` (must implement trapping and restoration), `window.confirm` (unstylable, blocks).

**Validation as a concept (strong for the top band).** Three layers: HTML attributes (semantics, mobile keyboards), accessible custom messages on submit and live while fixing, and a separate pure data-layer validation (`js/validation.js`) that also guards imports. Native validation bubbles were rejected because they are not consistently exposed to assistive technology and cannot be styled.

---

## 4. Accessibility candidates, with W3C references (pick up to five)

Reference format: WCAG 2.2 success criterion, with the W3C "Understanding" page.

1. **Bypass blocks and landmarks** — *SC 2.4.1 Bypass Blocks, SC 1.3.1 Info and Relationships.* `index.html`: skip link as the first focusable element; `<header>`, `<nav aria-label="Primary">`, `<main>`; headings in order, one `<h1>` per page. https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
2. **Forms: labels, errors and status messages** — *SC 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion, 4.1.3 Status Messages.* Errors are text plus an icon (not colour), tied by `aria-describedby`, `aria-invalid` set, focus moved to the first problem; results, saves and project changes announced through a polite live region (`#announcer`, `js/ui/announcer.js`). https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
3. **Colour is never the only signal; contrast is measured** — *SC 1.4.1 Use of Color, 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast.* Relationship badges combine a symbol, the word and a border; conflicts are an icon, bold text and an outline; every colour pair is computed by `tests/contrast.mjs` (43 pairs, light and dark). Real finding: the brand teal `#14B8A6` is only about 2.5:1 on white, so the darker `#0F766E` (5.5:1) is used for text and buttons. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
4. **Keyboard operation, visible focus, and focus not hidden** — *SC 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured (Minimum) [new in 2.2].* A 3px focus ring on every control; roving tabindex tabs with arrow keys, Home and End; native `<dialog>` for traps and focus return; focus moves to the page heading on navigation. Real finding: on phones the fixed bottom navigation hid focused buttons; CSS `scroll-padding` did not help, so `js/ui/focus.js` scrolls the focused control clear (found by a keyboard test and now guarded by it). https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
5. **Correct semantics and ARIA patterns** — *SC 4.1.2 Name, Role, Value; 1.3.1.* WAI-ARIA tabs (`tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`); data table with `<caption>`, `scope="col"`/`scope="row"` and hidden text giving each cell its meaning; a scroll region that is keyboard-focusable and named; native `<progress>` with a label; `aria-current="page"` on navigation. https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
6. **Reflow, text resizing and text spacing** — *SC 1.4.10 Reflow, 1.4.4 Resize Text, 1.4.12 Text Spacing.* No sideways page scrolling at 320px (only the matrix scrolls inside its own region); `rem` units; a text-spacing stress test (line height 1.5, letter spacing 0.12em, word spacing 0.16em) runs on every page. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
7. **Target size** — *SC 2.5.8 Target Size (Minimum).* Controls are at least 2.5–2.75rem (40–44px) tall against the 24px minimum. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
8. **Predictable navigation and page titles** — *SC 2.4.2 Page Titled, 3.2.3 Consistent Navigation.* The title changes with each page and paper; the same navigation in the same order everywhere.
9. **User preferences** — reduced motion (`prefers-reduced-motion`), forced colours (`forced-colors`), and a manual dark theme that follows the OS by default.

**Accessibility evidence you can cite** (all reproducible):
- `docs/testing/accessibility-audit.md`: **90 page audits** (15 pages/states × 3 viewports × 2 themes), axe-core WCAG 2.0/2.1/2.2 A+AA **and best-practice** rules: **0 violations**; keyboard-only pass on every page; text-spacing stress test; document checks.
- `docs/testing/lighthouse.md`: Lighthouse accessibility **100**, best practices **100**, SEO **100**, performance **98–99** on the four pages tested.
- `docs/testing/html-validation.md`: html-validate on the rendered DOM of 14 routes: no problems.
- The audit itself was **mutation-tested**: removing the focus outline, lightening a text colour, or removing the focus guard each made it fail, so a clean result is meaningful.
- Screenshots: `docs/testing/screenshots/` (index in its README).

### What the automated tests cannot tell you (do this yourself, and say so)
Automated tools find only part of the accessibility problems. **No screen reader was run during development** (the build environment had none), so the announcements and reading order are verified through the accessibility tree and live-region text, not by listening. Before submitting, spend 20 minutes and record the result honestly:
- **Screen reader:** NVDA with Firefox or Chrome on Windows (free), or VoiceOver on a Mac/iPhone. Try: skip link, a search and its results announcement, a form error, the tabs, the matrix table (table navigation with Ctrl+Alt+arrows), a dialog.
- **Keyboard only:** unplug the mouse; complete "create project, save a paper, record evidence".
- **Zoom:** browser zoom to 200% and 400%.
- **Real phone:** open the live URL.
Stating what you did and did not test is itself good critical evaluation.

---

## 5. Development decisions you can discuss (critical-evaluation material)
- **No framework:** the assessed concepts (CSS, forms, accessibility) stay visible in the code; trade-off: more hand-written code and manual state handling.
- **IndexedDB, not localStorage, for research data:** structured, queryable, larger quota, transactions (used for atomic import and cascade deletes); `localStorage` only for the theme and last-used project.
- **Accessibility treated as testable:** a whole-app audit, a keyboard check and contrast maths run in CI.
- **Untrusted data everywhere:** API results and backup files are stripped, whitelisted and escaped before use (mutation-tested).
- **Bugs that tests found** (honest reflection): grid columns stretched by wide children (three times, one root cause); hidden text escaping a scroll container; a "dirty form" check fooled by `<select>` defaults; focus hidden behind a fixed bar; browsers caching a failed module import.

## 6. AI transparency declaration (SHU AITS)
The brief requires an appendix declaring the AITS level and how AI was used, and says the *maximum permitted level for this assessment is highlighted in the table in the brief* (the highlight is not visible in the text extracted from the Word file, so **check the original brief**).

Facts you will need, which you should check against your own role before stating them:
- An AI assistant (Claude, by Anthropic) wrote the application source code, the automated tests, the build plan and the documentation in this repository, working to your direction across the stages in `docs/development-log.md`.
- The design decisions in `docs/development-log.md` (Teal Graphite visual direction, evidence-versus-interpretation model, scope exclusions, API choice) came out of earlier planning conversations with you.
- The written evaluation is yours to write. If you use AI for anything in it (outlining, proof-reading), that must be declared at the matching level too.

Pick the level that honestly describes the whole assessment, state it, and describe your own contribution. If the permitted level is lower than the AI's role in the code, **speak to the module team before submitting** rather than guessing.

---

## 7. Numbers (from the final full run)
| Check | Result |
|---|---|
| Unit tests (`npm test`) | **113 passed**, 0 failed |
| Browser checks (`npm run test:e2e`, 12 suites) | **484 passed**, 0 failed |
| Contrast pairs (`npm run contrast`) | **43 passed**, 0 failed |
| Page audits (`npm run audit`) | **90 passed**, 0 failures |
| HTML validation (`npm run validate`) | 14 routes, 0 problems |
| Lighthouse (4 pages) | Performance 98–99, Accessibility 100, Best practices 100, SEO 100 |

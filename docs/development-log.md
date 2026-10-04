# Development Log

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

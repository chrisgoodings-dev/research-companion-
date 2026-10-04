# Development Log

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

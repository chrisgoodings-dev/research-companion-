# Wireframes

Low-fidelity, annotated wireframes for **every page and overlay**. Each shows the **desktop and tablet layout** (768px and wider, with the sidebar) beside the **phone layout** (320px, with the bottom bar), so the responsive behaviour is visible at a glance. Numbered red markers on a wireframe are explained in the *Annotations* underneath it, including the accessibility behaviour.

They document the interface **as built**: the layout, content and behaviour match the running app at https://chrisgoodings-dev.github.io/research-companion-/ and its source in `index.html`, `css/` and `js/views/`. Wireframes are deliberately grey: they show structure, hierarchy and behaviour, not colour or typography (see `css/tokens.css` for the Teal Graphite design tokens).

## How to read them

| Convention | Meaning |
|---|---|
| Dark rectangle on the left (desktop) | The persistent sidebar navigation; the current page is highlighted |
| Dark bar at the bottom (phone) | The fixed bottom navigation: Dashboard, Discover, Library, Menu |
| Rounded box | A card (a grouped region of content) |
| Dashed red outline | A warning or destructive area (delete zone, error or failure notice) |
| Filled dark button | The primary action; outlined button: a secondary action; red outline: destructive |
| Underlined text | A link |
| Pill-shaped label | A badge or chip. Status is always carried by its **text** (and a symbol), never by colour |
| `⚠` before red text | A validation error (always icon plus words) |
| Red numbered circle | An annotation, explained below the wireframe |

## Responsive behaviour

| | Phone (under 48rem) | Tablet and desktop (48rem and wider) |
|---|---|---|
| Navigation | Fixed bottom bar with three destinations and a **Menu** button that opens a sheet with the rest | Persistent left sidebar with all seven destinations and **Backup and export** in the footer |
| Page layout | One column; cards stack | Two columns where it helps (a main column and a side column) |
| Card grids | Two columns (statistics) | Up to four columns, adapting to the available width |
| Forms | Fields stack one per row | Related fields sit side by side (for example the two year fields and the sort) |
| Wide table (matrix) | Scrolls sideways **inside its own region** with the paper column kept in view; the page never scrolls sideways | Fits the width |
| Dialogs | Centred, fitted to the screen | Centred |
| Touch targets | At least 40 to 44px tall | Same |

The layout is written **mobile first**: the base CSS is the phone layout and `min-width` media queries add the sidebar and extra columns.

## 1. Dashboard

![Dashboard wireframe: four statistic cards, a getting-started card and an at-a-glance card, with sidebar on desktop and bottom bar on phone](wireframes/dashboard.png)

## 2. Projects

![Projects wireframe: a list of project cards and a New project form with an inline validation error](wireframes/projects.png)

## 3. Project detail

![Project detail wireframe: breadcrumb, research questions with evidence counts, add-question form, saved papers, project details and a delete zone](wireframes/project-detail.png)

## 4. Discover: search form

![Discover wireframe showing the search form: keyword search, year filters, sort, open access checkbox, sources checkboxes](wireframes/discover-search.png)

## 5. Discover: results

![Discover results wireframe: result count, a source notice, paper cards with save buttons, and paging](wireframes/discover-results.png)

## 6. Library

![Library wireframe: filter panel and paper cards with project status chips](wireframes/library.png)

## 7. Paper detail: Overview tab

![Paper detail overview wireframe: project picker, tabs, facts, abstract, links and the projects the paper is saved in](wireframes/paper-overview.png)

## 8. Paper detail: Review tab

![Paper detail review wireframe: reading status radio group and six structured review fields](wireframes/paper-review.png)

## 9. Paper detail: Evidence tab

![Paper detail evidence wireframe: add-evidence form with relationship radio group, and recorded evidence cards separating what the paper reports from the researcher's interpretation](wireframes/paper-evidence.png)

## 10. Evidence

![Evidence page wireframe: filter panel, relationship totals and evidence cards across projects](wireframes/evidence.png)

## 11. Evidence matrix

![Evidence matrix wireframe: what stands out, papers by research questions table with relationship badges and a summary row, and a key](wireframes/matrix.png)

## 12. Progress

![Progress wireframe: summary counts, what to do next, reading progress bar and evidence coverage per research question](wireframes/progress.png)

## 13. Backup and export

![Backup and export wireframe: download backup, restore with preview and Merge or Replace, and CSV export](wireframes/backup.png)

## 14. Not found, empty and error states

![States wireframe: page not found, an empty library, a failed search and a storage-blocked message](wireframes/states.png)

## 15. Overlays: dialogs, menu sheet and toasts

![Overlays wireframe: confirm dialog with Cancel focused, save-to-project dialog, phone menu sheet, a toast and the live region](wireframes/overlays.png)

## Shared components and rules

These patterns repeat on every page, so they are specified once.

| Component | Rules | Implemented in |
|---|---|---|
| **Page heading** | One `<h1>` per page; focus moves to it after every route change and the page name is announced | `js/router.js` |
| **Form field** | Real `<label>`; "(required)" or "(optional)" written in the label; a hint; a live character counter where there is a limit; an error shown as `⚠` plus text, tied to the field with `aria-describedby` and `aria-invalid` | `js/ui/fields.js`, `js/ui/forms.js` |
| **Failed submit** | Focus moves to the first problem; the number of problems is announced | `js/ui/forms.js` |
| **Buttons** | Primary (filled), secondary (outlined), destructive (red outline); minimum height 40px | `css/components.css` |
| **Destructive action** | Always confirmed in a dialog whose first button, Cancel, has focus | `js/ui/confirm.js` |
| **Status** | Reading status, relationship, open-access status and saved state are written as text, with a symbol where useful; colour is never the only signal | `js/ui/evidenceUi.js`, views |
| **Tabs** | WAI-ARIA tabs: arrow keys, Home and End; selected tab marked by weight, underline and colour; the tab is kept in the address | `js/ui/tabs.js` |
| **Data table** | `<caption>`, `scope` headers, a keyboard-focusable named scroll region | `js/views/matrix.js` |
| **Progress** | Native `<progress>` with a name, plus the same fact as text | `js/views/progress.js` |
| **Empty and error states** | Every list and failure has an explanation and a next step, never a blank area | each view |
| **Live announcements** | One polite live region for results, saves, deletes, route and project changes | `js/ui/announcer.js` |

## Regenerating

The wireframes are generated from page descriptions in `scripts/wireframe-pages.mjs` (and `wireframe-overlays.mjs`) by a small drawing toolkit (`scripts/wireframe-lib.mjs`):

```bash
npm run wireframes      # writes docs/design/wireframes/*.svg and *.png
npm run design          # diagrams and wireframes together
```

SVG files are vector (sharp at any size); PNG files are 2x resolution for pasting into Word or slides.

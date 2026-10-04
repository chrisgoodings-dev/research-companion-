// One entry per page. Blocks come from wireframe-lib.mjs. Notes explain what each numbered callout means,
// including the accessibility behaviour, so the wireframes double as a specification.
const b = {
  h1: (s, n) => ({ t: 'h1', s, n }), h2: (s, n) => ({ t: 'h2', s, n }), h3: (s, n) => ({ t: 'h3', s, n }),
  p: (s, n) => ({ t: 'p', s, n }), note: (s, n) => ({ t: 'note', s, n }), crumb: (s, n) => ({ t: 'crumb', s, n }),
  bullets: (items, n) => ({ t: 'bullets', items, n }),
  card: (title, c, o = {}) => ({ t: 'card', title, c, ...o }),
  cols: (c, ratio, n) => ({ t: 'cols', c, ratio, n }),
  grid: (c, cols, n, phone) => ({ t: 'grid', c, cols, n, phone }),
  stat: (v, s) => ({ t: 'stat', v, s }),
  field: (s, o = {}) => ({ t: 'field', s, ...o }),
  fields: (c, n) => ({ t: 'fields', c, n }),
  fieldset: (s, c, n) => ({ t: 'fieldset', s, c, n }),
  radios: (opts, n) => ({ t: 'radios', opts, n }),
  checks: (opts, n) => ({ t: 'checks', opts, n }),
  buttons: (items, n) => ({ t: 'buttons', items, n }),
  chips: (items, n) => ({ t: 'chips', items, n }),
  badges: (items, n) => ({ t: 'badges', items, n }),
  tabs: (items, on, n) => ({ t: 'tabs', items, on, n }),
  progress: (s, pct, n) => ({ t: 'progress', s, pct, n }),
  link: (s, n, bold) => ({ t: 'link', s, n, bold }),
  line: (s, o = {}) => ({ t: 'line', s, ...o }),
  bars: (k, n) => ({ t: 'bars', k, n }),
  details: (s, n) => ({ t: 'details', s, n }),
  dl: (rows, n) => ({ t: 'dl', rows, n }),
  evidence: (o) => ({ t: 'evidence', ...o }),
  paper: (o) => ({ t: 'paper', ...o }),
  table: (o) => ({ t: 'table', ...o }),
  spacer: (h) => ({ t: 'spacer', h }),
  stack: (c, n) => ({ t: 'stack', c, n }),
};
export { b };

const projectCard = (title, desc, meta) => b.card(null, [b.link(title, null, true), b.line(desc, { size: 9.5, fill: '#555' }), b.note(meta)]);

export const pages = [
  {
    file: 'dashboard', title: 'Dashboard', route: '#/dashboard', active: 'Dashboard', src: 'js/views/dashboard.js',
    blocks: [
      b.h1('Dashboard', 1), b.p('Your research evidence workspace: discover papers, capture what they report, and relate it to your research questions.'),
      b.grid([b.stat('3', 'Research projects'), b.stat('7', 'Research questions'), b.stat('18', 'Saved papers'), b.stat('42', 'Evidence records')], 4, 2),
      b.cols([
        b.card('Get started', [b.bullets(['Create a research project and add your research questions.', 'Search for papers in Discover.', 'Save relevant papers to your project.', 'Record evidence and relate it to a question.', 'Review the Matrix to see where the evidence agrees or conflicts.']), b.buttons([{ s: 'Go to Projects', p: 1 }, 'Search papers'])], { n: 3 }),
        b.card('At a glance', [b.bullets(['Evidence matrix: see where papers agree or conflict', 'Progress: what to read and record next', 'Evidence: everything you have recorded']), b.note('Last backup: 3 Oct 2026. Back up now', 4)]),
      ], [3, 2]),
    ],
    notes: {
      1: 'One <h1> per page, and the page title (document title) changes with the route. On every route change focus moves to this heading and the page name is announced.',
      2: 'Four live counts read from IndexedDB, in a list. Large figures with text labels. On a phone they wrap to two columns.',
      3: 'Plain-language orientation for a first visit. Two columns on desktop, stacked on a phone.',
      4: 'Reminder of the last backup date (the only protection for data stored in the browser).',
      5: 'Navigation: persistent sidebar on desktop with a footer link to Backup and export; on a phone a bottom bar (Dashboard, Discover, Library, Menu). The skip link is the first focusable element on every page.',
    },
    navNote: 5,
  },
  {
    file: 'projects', title: 'Projects', route: '#/projects', active: 'Projects', src: 'js/views/projects.js',
    blocks: [
      b.h1('Projects'), b.p('A project is one literature review. Add the research questions it needs to answer.'),
      b.cols([
        b.stack([b.h2('Your projects'), projectCard('AI-assisted coding', 'Does AI help developers write better software?', '3 research questions · Updated 4 Oct 2026'), projectCard('Security of generated code', '', '2 research questions · Updated 2 Oct 2026')], 1),
        b.card('New project', [b.field('Project name', { req: true, hint: '3 to 80 characters, for example "AI-assisted coding".', counter: '0 / 80', err: 'Enter project name.' }), b.field('Description', { req: false, k: 'textarea', rows: 2, counter: '0 / 500' }), b.buttons([{ s: 'Create project', p: 1 }])], { n: 2 }),
      ], [3, 2]),
    ],
    notes: {
      1: 'Each project title is a link to its detail page. When there are no projects an empty state explains what to do. Lists are real <ul> lists.',
      2: 'Form pattern used everywhere: a real label with (required) or (optional) in text, a hint, a live character counter, and an error shown as an icon plus text, tied to the field with aria-describedby and aria-invalid. A failed submit moves focus to the first problem and announces how many fields need attention.',
    },
  },
  {
    file: 'project-detail', title: 'Project detail', route: '#/projects/:projectId', active: 'Projects', src: 'js/views/projects.js',
    blocks: [
      b.crumb('Projects  /  AI-assisted coding', 1), b.h1('AI-assisted coding'), b.p('Created 4 Oct 2026 · 3 research questions · 2 saved papers'),
      b.cols([
        b.stack([
          b.h2('Research questions'),
          b.card(null, [b.badges(['RQ1']), b.line('Does AI code generation improve developer productivity?', { bold: true }), b.link('2 evidence records', 2), b.buttons(['Edit', { s: 'Delete', d: 1 }])]),
          b.card(null, [b.badges(['RQ2']), b.line('What risks does AI-generated code introduce?', { bold: true }), b.note('No evidence recorded yet'), b.buttons(['Edit', { s: 'Delete', d: 1 }])]),
          b.card('Add a research question', [b.field('Research question', { req: true, k: 'textarea', rows: 2, hint: 'Ask one answerable question (10 to 300 characters).', counter: '0 / 300' }), b.buttons([{ s: 'Add question', p: 1 }])], { n: 3 }),
          b.h2('Saved papers'),
          b.paper({ title: 'Productivity Assessment of Neural Code Completion', authors: 'Albert Ziegler et al. · 2022', meta: 'Read · Reviewed', actions: ['Review', { s: 'Remove' }] }),
        ]),
        b.stack([
          b.card('Project details', [b.field('Project name', { req: true, v: 'AI-assisted coding', counter: '18 / 80' }), b.field('Description', { req: false, k: 'textarea', rows: 2, counter: '0 / 500' }), b.buttons([{ s: 'Save details', p: 1 }])]),
          b.card('Delete project', [b.line('Permanently removes this project, its research questions and any evidence recorded against them.', { size: 9.5 }), b.buttons([{ s: 'Delete project', d: 1 }])], { dash: 1, n: 4 }),
        ]),
      ], [3, 2]),
    ],
    notes: {
      1: 'Breadcrumb navigation (a labelled <nav> with an ordered list); the current page is marked aria-current.',
      2: 'Each question shows how much evidence it has, linking to the Evidence page filtered to that question.',
      3: 'Editing a question happens in place: the card turns into a form, focus moves into it, and returns to the Edit button when saved or cancelled. Adding focuses the field again for the next entry.',
      4: 'Destructive actions are visually separated and always ask first. The confirmation dialog focuses Cancel, not the destructive button, and Esc cancels. Deleting cascades to questions, saved-paper links and evidence.',
    },
  },
  {
    file: 'discover-search', title: 'Discover: search form', route: '#/discover', active: 'Discover', src: 'js/views/discover.js',
    blocks: [
      b.h1('Discover'), b.p('Search scholarly papers through OpenAlex and Crossref, then save the useful ones to a project.'),
      b.card(null, [
        b.field('Search for papers', { req: true, k: 'search', v: 'ai code generation', hint: 'Keywords or a phrase, for example "AI code generation productivity".' }),
        b.fieldset('Filters', [b.fields([b.field('Earliest year', { req: false, v: '2020', hint: 'A four-digit year, e.g. 2020.' }), b.field('Latest year', { req: false, v: '2024', hint: 'A four-digit year, e.g. 2024.' }), b.field('Sort by', { k: 'select', v: 'Relevance', hint: 'How results are ordered.' })], 2), b.checks([{ s: 'Open access only', d: 'Only papers that can be read for free. Crossref is skipped when this is on.', on: true }], 3)]),
        b.fieldset('Sources', [b.line('Choose at least one. Results are merged and duplicates (same DOI) combined.', { size: 9, fill: '#777' }), b.checks(['OpenAlex', 'Crossref'], 4)]),
        b.buttons([{ s: 'Search', p: 1 }], 5),
      ], { n: 1 }),
      b.section ?? b.card('Results', [b.line('Enter a search above to find papers.', { fill: '#555' })], { dash: 0 }),
    ],
    notes: {
      1: 'The form is a role="search" landmark. The keyword box is type="search" (enterkeyhint="search") and required, 2 to 200 characters.',
      2: 'Year fields are type="number" with min, max, step and numeric keyboard on phones. A cross-field rule (earliest not after latest) puts a specific error on the second field. On a phone the three fields stack.',
      3: 'A single checkbox for a yes/no filter, with its explanation as a described hint.',
      4: 'Checkbox group sharing one name (read back as a list). At least one source is required; otherwise the error appears on the first checkbox.',
      5: 'Searching updates the address (?q=...&from=...&oa=1...), so a search can be bookmarked, shared and restored with the Back button. The results area announces the count to screen readers.',
    },
  },
  {
    file: 'discover-results', title: 'Discover: results', route: '#/discover?q=copilot', active: 'Discover', src: 'js/views/discover.js',
    blocks: [
      b.h1('Discover'), b.line('[ search form as on the previous wireframe ]', { fill: '#888' }),
      b.h2('Results', 1), b.p('About 5,678 results for "copilot" from OpenAlex and Crossref. Page 1 of 62.', 2),
      b.card(null, [b.line('Crossref could not be searched: The search service is busy (too many requests). Wait a moment and try again.', { size: 9.5, bold: true })], { dash: 1, n: 3 }),
      b.paper({ title: 'Productivity Assessment of Neural Code Completion', authors: 'Albert Ziegler, Eirini Kalliamvakou et al.', n: 4, meta: '2022 · Proceedings of the 6th ACM SIGPLAN Symposium', badges: ['Open access (green)', 'Cited by 214'], abstract: 1, doi: 'DOI: 10.1145/3597503.3608128', found: 'Found in: OpenAlex, Crossref', actions: ['Save to project'] }),
      b.paper({ title: 'Is GitHub Copilot a Substitute for Human Pair-programming?', authors: 'Ranim Khojah, Mazen Mohamad', meta: '2023 · Journal of Systems & Software', badges: ['Cited by 87'], found: 'Found in: OpenAlex', actions: ['Save to another project'], saved: 'Saved to: AI-assisted coding' }),
      b.buttons(['Previous', 'Next']),
    ],
    notes: {
      1: 'Results live in a section with aria-busy while loading. A loading message, "no results" advice and specific error messages with a Try again button cover every state.',
      2: 'The count is shown AND announced through a polite live region. "About" appears when two sources were merged, because the overlap cannot be known.',
      3: 'If one source fails the other\'s results are still shown with this notice. A failure never looks like "no results".',
      4: 'Each card: title link (opens a new tab, with that said in text), authors, year and venue, open-access status as TEXT, citation count, abstract in a native <details>, DOI link, and which sources found it. The saved state is text ("Saved to: ..."), never colour alone. Paging moves focus to the Results heading.',
    },
  },
  {
    file: 'library', title: 'Library', route: '#/library', active: 'Library', src: 'js/views/library.js',
    blocks: [
      b.h1('Library'), b.p('Every paper you have saved, across all projects.'),
      b.card(null, [
        b.field('Filter by keyword', { k: 'search', hint: 'Matches title, authors, venue, year or DOI.' }),
        b.fields([b.field('Project', { k: 'select', v: 'All projects' }), b.field('Reading status', { k: 'select', v: 'Any status' }), b.field('Sort by', { k: 'select', v: 'Recently saved' })]),
      ], { n: 1 }),
      b.line('3 papers shown of 18.', { fill: '#555' }),
      b.paper({ title: 'Productivity Assessment of Neural Code Completion', authors: 'Albert Ziegler, Eirini Kalliamvakou et al.', meta: '2022 · Proceedings of the 6th ACM SIGPLAN Symposium', chips: ['AI-assisted coding: Read · Reviewed', 'Security: Unread'], n: 2 }),
      b.paper({ title: 'Is GitHub Copilot a Substitute for Human Pair-programming?', authors: 'Ranim Khojah, Mazen Mohamad', meta: '2023 · Journal of Systems & Software', chips: ['AI-assisted coding: Reading'] }),
      b.paper({ title: 'Security Weaknesses of Copilot Generated Code', authors: 'Yujia Fu et al.', meta: '2023 · IEEE Transactions on Software Engineering', chips: ['Security: Unread'] }),
    ],
    notes: {
      1: 'Live filtering: results update as you type or choose, with no submit button. The panel is a role="search" container, and the filters are kept in the address (replaceState, so no history entry per keystroke). The count is a polite status region, updated after a short pause so typing is not announced letter by letter.',
      2: 'A chip per project shows status as text ("Read · Reviewed"). An empty library, and "no matches" with a Clear filters button, each have their own state.',
    },
  },
  {
    file: 'paper-overview', title: 'Paper detail: Overview tab', route: '#/library/:paperId', active: 'Library', src: 'js/views/library.js',
    blocks: [
      b.crumb('Library  /  Productivity Assessment of Neural Code Completion'), b.h1('Productivity Assessment of Neural Code Completion'), b.p('Albert Ziegler, Eirini Kalliamvakou, Shawn Simister et al. · 2022'),
      b.field('Working in project', { k: 'select', v: 'AI-assisted coding', hint: 'Applies to the Review and Evidence tabs. Each project keeps its own review and evidence for this paper.' }),
      b.tabs(['Overview', 'Review', 'Evidence'], 0, 1),
      b.card(null, [
        b.dl([['Authors', 'Albert Ziegler, Eirini Kalliamvakou et al.'], ['Year', '2022'], ['Venue', 'Proceedings of the 6th ACM SIGPLAN Symposium'], ['Type', 'article'], ['DOI', '10.1145/3597503.3608128'], ['Citations', '214'], ['Access', 'Open access (green)'], ['Found in', 'OpenAlex, Crossref']], 2),
        b.h3('Abstract'), b.bars(4), b.h3('Read the paper'), b.buttons(['Publisher page', 'Open-access full text']), b.h3('Saved in'), b.chips(['AI-assisted coding: Read · saved 4 Oct 2026', 'Security of generated code: Unread']),
      ]),
    ],
    notes: {
      1: 'Tabs follow the WAI-ARIA tabs pattern: a tablist of tab buttons, one tabpanel each. Only the selected tab is in the Tab order (roving tabindex); Left and Right move between tabs, Home and End jump to the first and last; the selected tab is shown by weight, an underline bar AND colour. The chosen tab and project are kept in the address (?tab=review&project=...).',
      2: 'Facts as a description list (term and definition). External links say in text that they open a new tab. Every dynamic value is escaped. The project picker appears only when the paper is saved in more than one project, and asks before discarding unsaved text.',
    },
  },
  {
    file: 'paper-review', title: 'Paper detail: Review tab', route: '#/library/:paperId?tab=review', active: 'Library', src: 'js/views/library.js',
    blocks: [
      b.crumb('Library  /  Productivity Assessment of Neural Code Completion'), b.h1('Productivity Assessment of Neural Code Completion'),
      b.tabs(['Overview', 'Review', 'Evidence'], 1),
      b.card(null, [
        b.fieldset('Reading status', [b.radios([{ s: 'Unread' }, { s: 'Reading', on: true }, { s: 'Read' }])], 1),
        b.field('Study aim', { req: false, k: 'textarea', rows: 2, hint: 'What question did the authors set out to answer?', counter: '0 / 2000' }),
        b.field('Methodology', { req: false, k: 'textarea', rows: 2, hint: 'Study design, how data was collected and how it was analysed.', counter: '0 / 2000' }),
        b.field('Participants or dataset', { req: false, k: 'textarea', rows: 2, counter: '0 / 2000' }),
        b.field('Key findings', { req: false, k: 'textarea', rows: 2, hint: 'What the paper reports, in its own terms. Put your own interpretation in the notes below.', counter: '0 / 2000' }, 2),
        b.field('Limitations and threats to validity', { req: false, k: 'textarea', rows: 2, counter: '0 / 2000' }),
        b.field('General notes', { req: false, k: 'textarea', rows: 2, hint: 'Anything else worth remembering, including your own interpretation.', counter: '0 / 2000' }),
        b.stack([b.buttons([{ s: 'Save review', p: 1 }]), b.note('Last saved 4 Oct 2026')], 3),
      ]),
    ],
    notes: {
      1: 'Reading status is a radio group in a fieldset with a legend: three mutually exclusive options that are all visible at once, so a select would hide information the user needs. The control group has one Tab stop; arrow keys move within it.',
      2: 'The hint separates what the paper reports from the researcher\'s own reading, which carries into the evidence model (evidence and interpretation are separate fields).',
      3: 'One review per paper per project, stored on the project link. "Last saved" gives feedback in text; saving also announces "Review saved". A "written" review means at least one field has text.',
    },
  },
  {
    file: 'paper-evidence', title: 'Paper detail: Evidence tab', route: '#/library/:paperId?tab=evidence', active: 'Library', src: 'js/views/library.js, js/ui/evidenceUi.js',
    blocks: [
      b.crumb('Library  /  Productivity Assessment of Neural Code Completion'), b.h1('Productivity Assessment of Neural Code Completion'),
      b.tabs(['Overview', 'Review', 'Evidence'], 2),
      b.card('Add evidence', [
        b.field('Research question', { req: true, k: 'select', v: 'Choose a research question', hint: 'Which question does this evidence help answer?', err: 'Choose research question.' }),
        b.fieldset('Relationship (required)', [b.radios([{ s: '✓ Supports', d: 'The findings point towards a positive answer.' }, { s: '✗ Contradicts', d: 'The findings point against it.' }, { s: '± Mixed', d: 'Some findings support it and some do not.' }, { s: 'ℹ Contextual', d: 'Useful background; it does not answer directly.' }, { s: '∅ No evidence', d: 'The paper looked but found nothing either way.' }])], 1),
        b.field('Evidence from the paper', { req: true, k: 'textarea', rows: 2, hint: 'What the paper reports. Keep your own opinion out of this box.', counter: '0 / 3000' }, 2),
        b.field('Your interpretation', { req: false, k: 'textarea', rows: 2, counter: '0 / 3000' }),
        b.fields([b.field('Page, section or table', { req: false, v: 'Table 2' }), b.field('Tags', { req: false, hint: 'Separate with commas.' })]),
        b.buttons([{ s: 'Add evidence', p: 1 }]),
      ]),
      b.h3('Recorded evidence (2)', 3),
      b.evidence({ rq: 'RQ2', rel: '✗ Contradicts', q: 'What risks does AI-generated code introduce?', ev: 'More defects were found in generated code than in hand-written code.', tags: ['quality', 'defects'], actions: ['Edit', 'Delete'] }),
      b.evidence({ rq: 'RQ1', rel: '✓ Supports', q: 'Does AI code generation improve developer productivity?', ev: 'Developers completed the task 55% faster (n = 95).', mine: 'Strong effect, but a single small lab task.', tags: ['productivity', 'speed'], actions: ['Edit', 'Delete'] }),
    ],
    notes: {
      1: 'The relationship is a radio group of five, each with a one-line definition and NOTHING pre-selected, so choosing is deliberate. Every relationship has its own symbol AND a text label; meaning never depends on colour. Failing to choose puts an error on the first radio, linked by aria-describedby.',
      2: 'Evidence (required) and interpretation (optional) are separate fields so the method of keeping reporting apart from inference is built into the data. Whitespace-only text is rejected.',
      3: 'Records appear below, newest first. The paper\'s evidence and the researcher\'s interpretation are separately labelled blocks (the interpretation has a dashed edge). After adding, focus returns to the first field for the next entry; deleting asks first and then moves focus to this heading.',
    },
  },
  {
    file: 'evidence', title: 'Evidence', route: '#/evidence', active: 'Evidence', src: 'js/views/evidence.js',
    blocks: [
      b.h1('Evidence'), b.p('Everything you have recorded, across your projects: what each paper reports, tied to a research question.'),
      b.card(null, [
        b.field('Filter by keyword', { k: 'search', hint: 'Matches the evidence, your interpretation, location, tags and paper title.' }),
        b.fields([b.field('Project', { k: 'select', v: 'All projects' }), b.field('Research question', { k: 'select', v: 'All research questions' }), b.field('Paper', { k: 'select', v: 'All papers' })]),
        b.fields([b.field('Relationship', { k: 'select', v: 'Any relationship' }), b.field('Tag', { k: 'select', v: 'Any tag' })]),
      ], { n: 1 }),
      b.line('3 evidence records shown of 42.', { fill: '#555' }),
      b.line('Supports 2 · Contradicts 1 · Mixed 0 · Contextual 0 · No evidence 0', { size: 9, fill: '#555', bold: true }),
      b.evidence({ rq: 'AI-assisted coding · RQ1', rel: '✓ Supports', q: 'Does AI code generation improve developer productivity?', paper: 'Productivity Assessment of Neural Code Completion', ev: 'Developers completed the task 55% faster (n = 95).', mine: 'Strong effect, but a single small lab task.', tags: ['productivity'] }),
      b.evidence({ rq: 'AI-assisted coding · RQ1', rel: '✗ Contradicts', q: 'Does AI code generation improve developer productivity?', paper: 'Is GitHub Copilot a Substitute for Human Pair-programming?', ev: 'No measurable gain for experienced developers.', tags: ['experience'] }),
    ],
    notes: {
      1: 'Live filters (no submit). The question list is grouped by project with <optgroup> and narrows when a project is chosen. A paper filter lets the matrix drill straight to one cell\'s evidence. State is kept in the address, so a filtered view can be bookmarked or linked from the matrix and progress pages.',
      2: 'Totals by relationship are stated as text. Each card names its project and question, links to the paper\'s Evidence tab, and keeps "from the paper" and "your interpretation" visually separate.',
    },
  },
  {
    file: 'matrix', title: 'Evidence matrix', route: '#/matrix?project=:id', active: 'Matrix', src: 'js/views/matrix.js',
    blocks: [
      b.h1('Evidence matrix'), b.p('Each paper against each research question. See where the evidence agrees, conflicts or is missing.'),
      b.card(null, [b.field('Project', { k: 'select', v: 'AI-assisted coding' })]),
      b.line('3 papers × 3 research questions · 5 evidence records', { fill: '#555', size: 9.5 }),
      b.card('What stands out', [b.bullets(['RQ1: evidence conflicts (Supports 3, Contradicts 1).', 'No evidence yet for: RQ3.', '1 saved paper with no evidence recorded yet: A Paper With No Evidence Yet.'])], { n: 1 }),
      b.table({ n: 2, head: ['Paper', 'RQ1', 'RQ2', 'RQ3'], rows: [[['A Paper With No Evidence Yet', 'Ada Lovelace et al. · 2021'], '—', '—', '—'], [['Productivity Assessment…', 'Ada Lovelace et al. · 2022'], ['✓ Supports (2)', '✗ Contradicts'], '—', '—'], [['Security Weaknesses…', 'Ada Lovelace et al. · 2023'], ['✓ Supports'], ['ℹ Contextual'], '—']], foot: [['2 of 3 papers', 'Supports 3, Contradicts 1', '⚠ Evidence conflicts'], ['1 of 3 papers', 'Contextual 1', ''], ['0 of 3 papers', 'No evidence recorded', '']] }),
      b.card('Key', [b.bullets(['✓ Supports · ✗ Contradicts · ± Mixed · ℹ Contextual · ∅ No evidence', '— No evidence recorded for this paper and question.']), b.line('RQ1 Does AI improve developer productivity? · RQ2 … · RQ3 …', { size: 9, fill: '#555' })], { n: 3 }),
    ],
    notes: {
      1: 'Conflicts and gaps are written as sentences, so the synthesis does not depend on scanning a grid or on colour.',
      2: 'A real <table> with a caption, scope="col" headers (RQ1 plus the full question as hidden text) and scope="row" headers, and a footer summary row. Each cell is a link to the evidence behind it, with hidden text giving paper, question and counts. The conflict flag is an icon, bold text and an outline. On a phone the table scrolls sideways INSIDE its own keyboard-focusable region (named by the caption) with the paper column kept in view, so the page itself never scrolls sideways.',
      3: 'The key explains every symbol and lists each question in full. Rows are sorted alphabetically so a paper is easy to find.',
    },
  },
  {
    file: 'progress', title: 'Progress', route: '#/progress?project=:id', active: 'Progress', src: 'js/views/progress.js',
    blocks: [
      b.h1('Progress'), b.p('How far each project\'s review has got, and what to do next.'),
      b.card(null, [b.field('Project', { k: 'select', v: 'AI-assisted coding' })]),
      b.grid([b.stat('5', 'Saved papers'), b.stat('3', 'Read'), b.stat('1', 'With a review'), b.stat('3', 'Evidence records')], 4, 1),
      b.card('What to do next', [b.bullets(['1 saved paper has not been read yet.', '1 paper marked as read has no evidence recorded: Read but nothing recorded.', 'RQ1: the evidence conflicts (1 supporting, 1 contradicting). Compare the studies\' methods and limitations.', 'RQ3 has no evidence yet.'])], { n: 2 }),
      b.card('Reading progress', [b.progress('3 of 5 papers read (60%)', 0.6), b.note('Unread 1 · Reading 1 · Read 3'), b.h3('Not read yet'), b.link('Not started'), b.h3('Read, but no evidence recorded'), b.link('Read but nothing recorded')], { n: 3 }),
      b.h2('Evidence by research question'),
      b.card(null, [b.line('RQ1  Does AI improve developer productivity?', { bold: true }), b.progress('Evidence from 2 of 5 papers', 0.4), b.note('Supports 1, Contradicts 1'), b.badges(['⚠ Evidence conflicts']), b.link('View 2 evidence records')]),
      b.buttons(['Open the evidence matrix']),
    ],
    notes: {
      1: 'Four counts as text. "With a review" counts a review only if at least one field has text, so setting just a reading status is not mistaken for a review.',
      2: 'Written next steps, in priority order, generated from the data. Nothing important is carried only by a chart.',
      3: 'Native <progress> elements with an accessible name (linked to the visible label) and the same fact stated in text. Explicit fill and track colours keep the bar readable (non-text contrast 3:1). To-do items link to each paper\'s Review tab.',
    },
  },
  {
    file: 'backup', title: 'Backup and export', route: '#/backup', active: 'Backup', src: 'js/views/backup.js',
    blocks: [
      b.h1('Backup & export'), b.p('Your research lives only in this browser. Clearing site data, or switching browser or device, would erase it, so keep a backup.'),
      b.card('Back up your data', [b.bullets(['3 projects · 7 research questions · 18 papers', '18 saved paper links · 42 evidence records']), b.note('Last backup downloaded 3 Oct 2026.'), b.buttons([{ s: 'Download backup (JSON)', p: 1 }])], { n: 1 }),
      b.card('Restore from a backup', [
        b.field('Backup file (.json, up to 20 MB)', { hint: 'Files from other apps, or edited by hand, may be refused.', v: '[Choose File]  backup-2026-10-04.json' }),
        b.card(null, [b.line('Backup made on 4 Oct 2026 is valid. It contains: 3 projects, 7 questions, 18 papers…', { size: 9.5, bold: true }), b.fieldset('How should it be restored?', [b.radios([{ s: 'Merge with my current data', d: 'Adds what is missing. Anything you already have is kept.', on: true }, { s: 'Replace everything', d: 'Deletes your current data first.' }])]), b.buttons([{ s: 'Restore', p: 1 }])], { n: 2 }),
      ], { n: 0 }),
      b.card('Export for analysis (CSV)', [b.buttons(['Evidence (all projects)', 'Papers and reviews (all projects)']), b.field('Evidence matrix for project', { k: 'select', v: 'AI-assisted coding' }), b.buttons(['Matrix (CSV)'])], { n: 3 }),
    ],
    notes: {
      1: 'Downloads one JSON file (a local Blob link; nothing is uploaded). The date of the last backup is shown here and on the dashboard.',
      2: 'A restored file is treated as untrusted. It is fully validated and PREVIEWED before anything changes; an invalid file lists up to 25 problems with exact locations and says "Nothing was changed". Merge (the safe default) keeps existing records; Replace asks for confirmation with Cancel focused. The whole restore is one transaction, so it happens completely or not at all.',
      3: 'CSV files open in a spreadsheet. Cells that could be run as formulas (starting = + - @) are neutralised; files carry a byte-order mark so Excel reads them as UTF-8.',
    },
  },
  {
    file: 'states', title: 'Not found, empty and error states', route: 'any other address, and states within pages', active: 'Dashboard', src: 'js/views/notfound.js and each view',
    blocks: [
      b.h1('Page not found', 1), b.p('That address does not match a page in SE Research Hub: #/no-such-page.'),
      b.card('Where would you like to go?', [b.buttons([{ s: 'Dashboard', p: 1 }, 'Projects', 'Discover papers'])]),
      b.h2('Empty state (Library)', 2), b.card('Your library is empty', [b.line('Search for papers in Discover and save the useful ones to a project. They will appear here.', { size: 9.5 }), b.buttons([{ s: 'Find papers', p: 1 }])]),
      b.h2('Search failed', 3), b.card('Search failed', [b.line('The search service is busy (too many requests). Wait a moment and try again.', { size: 9.5 }), b.buttons([{ s: 'Try again', p: 1 }])], { dash: 1 }),
      b.h2('Storage blocked', 4), b.card('This section could not load', [b.line('IndexedDB is not available in this browser. Your browser may be blocking local storage (for example in a private window).', { size: 9.5 })], { dash: 1 }),
    ],
    notes: {
      1: 'The unknown-address page keeps the same layout and navigation, shows the address as escaped text, and offers ways back. The heading still receives focus.',
      2: 'Every list has an explained empty state with the next step as a button, never a blank area.',
      3: 'API failures are specific (offline, busy, timed out, server error, unexpected reply), role="alert", with a Try again button. A failure is never shown as "no results".',
      4: 'If browser storage is unavailable, each page keeps its heading and explains the problem instead of crashing; Discover still searches and says saving is unavailable.',
    },
  },
];

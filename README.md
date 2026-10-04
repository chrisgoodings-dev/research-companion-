# SE Research Hub

A small web app for finding research papers and keeping notes on what they say.

**Live site:** https://chrisgoodings-dev.github.io/research-companion-/

Module: Web Technologies (55-709700). Built with plain HTML, CSS and JavaScript: no framework and no build step.

## What it does

| Page | File | What you can do |
|---|---|---|
| Search | `index.html` | Search the [OpenAlex](https://docs.openalex.org/) API by keyword, with a year filter, a sort order and an open-access option |
| Paper | `paper.html?id=W...` | Read a paper's details and abstract (a second API call, by ID) and save it with a reading status |
| Reading list | `list.html` | Filter saved papers, record a research question, and write a note for each paper that keeps **evidence** (what the paper reports) apart from **interpretation** (what you think it means) |

Saved papers are stored in the browser's `localStorage`. Nothing is sent to a server of mine.

## Files

```
index.html, paper.html, list.html   the three pages
css/styles.css                      all styling (mobile-first)
js/api.js                           OpenAlex calls and abstract rebuilding
js/storage.js                       reading list in localStorage
js/forms.js                         validation and error messages
js/site.js                          menu button and small shared helpers
js/search-page.js, paper-page.js, list-page.js   one script per page
```

## Run it locally

Open the folder with any static web server, for example `python3 -m http.server`, then visit http://localhost:8000. (Opening the files directly with `file://` will not work because the scripts are ES modules.)

## Deploy

Pushing to `main` publishes the site with GitHub Pages (`.github/workflows/pages.yml`).

## Make the submission ZIP

```
git archive --format=zip -o submission.zip HEAD
```

## Sources and credits

- Paper data: [OpenAlex](https://openalex.org/), used under its open data licence. The abstract rebuilding in `js/api.js` follows OpenAlex's documentation of its "inverted index" format.
- Colours checked for contrast with the WCAG 2.2 contrast formula.
- AI assistance: see the AI transparency declaration submitted with the assessment.

## Possible future work

Pagination controls, tags, export of the reading list, and a second API.

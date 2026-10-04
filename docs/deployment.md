# Deployment

SE Research Hub is a **static site** (HTML, CSS and JavaScript modules, no build step and no server), so it can be hosted anywhere that serves files. It uses only relative URLs and hash routes (`#/projects`), so it works at a site root or under a sub-path such as `https://<user>.github.io/research-companion-/` (tested by `tests/e2e/subpath.mjs`).

## Before you deploy

1. **Contact email.** `js/config.js` holds `CONTACT_EMAIL`. It is sent to OpenAlex and Crossref as the `mailto` parameter (their "polite pool"). Anyone using the site can see it in the browser's network tab, and it is visible in the source if the repository is public. Use an address you are happy to share, or leave it blank.
2. **Repository visibility.** GitHub Pages on a *private* repository needs a paid GitHub plan. On a free account the repository must be public.
3. Run the tests locally once: `npm install`, `npm test`, `npm run test:e2e`.

## Option A: GitHub Pages (workflow included)

`.github/workflows/pages.yml` runs the unit tests, contrast checks and every browser suite on each push, and deploys only if they all pass. Only `index.html`, `css/` and `js/` are published.

1. Push the repository to GitHub (already done if you are reading this there).
2. **Settings, Pages, Build and deployment, Source: GitHub Actions.**
3. Push to `main` (or run the workflow from the Actions tab). The deploy job prints the live URL; it will look like `https://chrisgoodings-dev.github.io/research-companion-/`.
4. Paste the URL into the `Live site` line of `README.md` and into your written evaluation.

If the push of the workflow file is refused (GitHub requires the `workflow` permission for that), add the file through the GitHub web interface instead.

## Option B: Cloudflare Pages

1. Cloudflare dashboard, **Workers & Pages, Create, Pages, Connect to Git**, choose the repository.
2. Framework preset: **None**. Build command: `mkdir -p _site && cp -r index.html css js _site/`. Build output directory: `_site`.
3. Deploy. The site is served at `https://<project>.pages.dev/`. Cloudflare compresses text files and serves over HTTP/2 or HTTP/3, so Lighthouse performance is usually a little higher than the local figures in `docs/testing/lighthouse.md`.

## After deploying: acceptance checklist

Open the live URL in a normal browser (not the test container) and check:

- [ ] The dashboard loads, with no console errors (DevTools, Console).
- [ ] **Discover**: a real search (for example "AI code generation productivity") returns results from OpenAlex and Crossref. This is the one thing the automated tests cannot prove, because they use recorded sample responses. If results look wrong or a source fails, note the browser console message.
- [ ] Create a project and a research question, save a paper, record evidence, open the matrix. Reload the page: everything is still there.
- [ ] **Backup & export**: download a backup, then restore it.
- [ ] Lighthouse (Chrome DevTools, Lighthouse tab) on the live URL, for the accessibility evidence in your write-up.
- [ ] Keyboard-only and screen-reader pass (see `docs/assessment/writeup-evidence.md`, "What the automated tests cannot tell you").
- [ ] The URL works in a private window (a different browser profile has an empty workspace, which is expected: data is stored per browser).

# Lighthouse results

Lighthouse 13.5.0, headless Chromium, default **mobile** profile (simulated slow 4G, 4x CPU slowdown), served from a local static server with no compression or caching. Each route was run once on an **empty** workspace. Re-run with:

```bash
npm start                       # serves http://localhost:8080
npx lighthouse "http://localhost:8080/#/dashboard" --only-categories=performance,accessibility,best-practices,seo
```

| Page | Performance | Accessibility | Best practices | SEO | First contentful paint | Largest contentful paint | Blocking time | Layout shift | Requests |
|---|---|---|---|---|---|---|---|---|---|
| dashboard | 99 | 100 | 100 | 100 | 1.4 s | 1.7 s | 0 ms | 0 | 20 |
| discover | 98 | 100 | 100 | 100 | 1.5 s | 2.2 s | 0 ms | 0 | 31 |
| library | 98 | 100 | 100 | 100 | 1.5 s | 2.2 s | 0 ms | 0.025 | 28 |
| matrix | 99 | 100 | 100 | 100 | 1.5 s | 2.0 s | 0 ms | 0.006 | 24 |

## What changed performance, and why

| Change | Before | After |
|---|---|---|
| Each page's code is loaded with a dynamic `import()` the first time it is visited (code splitting without a bundler) | 47 requests on the dashboard, performance 95, largest contentful paint 2.8 s | 20 requests, performance 99, largest contentful paint 1.7 s |
| `<link rel="modulepreload">` for the shell and first-page chain | modules discovered one import at a time | fetched in parallel |
| Print stylesheet marked `media="print"` | render-blocking on screen | not blocking |

## Known, deliberate trade-offs

- **Unminified CSS and JavaScript** (Lighthouse "minify" audits score 0.5). The source is kept readable on purpose: it is the assessed submission, and compression by the host (GitHub Pages and Cloudflare Pages gzip or brotli text files) recovers most of the size. A minifying build step would add tooling without changing behaviour.
- **Render-blocking CSS**: four small stylesheets are needed before first paint, to avoid a flash of unstyled content.
- Scores on a real host with compression and HTTP/2 will usually be higher than on this local server.
- Accessibility, best practices and SEO are 100 on every page tested; these checks complement, and do not replace, the axe sweep and keyboard audit in `accessibility-audit.md`.

/** Shared helpers for turning any provider's record into the app's own Paper shape:
 *  { id, doi, title, authors[], year, venue, abstract, url, oaUrl, isOa, oaStatus, citedBy, type, source, sourceId }
 *  Provider modules (OpenAlex now, Crossref later) normalise into this so the UI never cares where data came from. */

/** Strip tags such as <i> that publishers leave in titles. Output is still escaped when rendered. */
export function stripTags(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode the few entities Crossref leaves in its JATS/XML strings. Done AFTER tag stripping and the
 *  result is still escaped when rendered, so this can never create live markup. */
export function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Crossref abstracts are JATS XML ("<jats:title>Abstract</jats:title><jats:p>…</jats:p>"): tags become
 *  spaces (so blocks do not run together), then the repeated "Abstract" label is dropped. */
export function cleanAbstract(value) {
  const text = decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim();
  return text.replace(/^(abstract\s*[:.\-–—]?\s*)+/i, '').trim();
}

/** "https://doi.org/10.1000/ABC" -> "10.1000/abc". Returns '' if it does not look like a DOI. */
export function normaliseDoi(value) {
  const doi = String(value ?? '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '').toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : '';
}

/** Links come from external data, so only http(s) is ever allowed (blocks javascript: and data: URLs). */
export function safeUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

/** "A, B, C" or "A, B, C et al." */
export function formatAuthors(authors, max = 4) {
  if (!authors?.length) return 'Unknown authors';
  return authors.length > max ? `${authors.slice(0, max).join(', ')} et al.` : authors.join(', ');
}

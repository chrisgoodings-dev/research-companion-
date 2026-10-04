export const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const STATUS_LABEL = { unread: 'Unread', reading: 'Reading', read: 'Read' };

export const REL_LABEL = { supports: 'Supports', contradicts: 'Contradicts', mixed: 'Mixed', contextual: 'Contextual', none: 'No evidence' };
export const REL_HELP = {
  supports: 'The findings point towards a positive answer to the question.',
  contradicts: 'The findings point against it.',
  mixed: 'Some findings support it and some do not.',
  contextual: 'Useful background; it does not answer the question directly.',
  none: 'The paper looked but found nothing either way.',
};
/** Every relationship has its own symbol AND a text label, so meaning never depends on colour (WCAG 1.4.1). */
export const REL_SYMBOL = { supports: '✓', contradicts: '✗', mixed: '±', contextual: 'ℹ', none: '∅' };

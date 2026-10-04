export const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const STATUS_LABEL = { unread: 'Unread', reading: 'Reading', read: 'Read' };

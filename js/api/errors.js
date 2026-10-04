/** One error type for every external API failure, so the UI can show a helpful, specific message. */
export class ApiError extends Error {
  /** kind: 'network' | 'timeout' | 'rate-limit' | 'server' | 'http' | 'bad-response' | 'aborted' */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    Object.assign(this, extra);
  }

  /** Plain-language explanation plus what the user can do about it. */
  get userMessage() {
    switch (this.kind) {
      case 'network': return 'Could not reach the search service. Check your internet connection and try again.';
      case 'timeout': return 'The search service took too long to respond. Please try again.';
      case 'rate-limit': return 'The search service is busy (too many requests). Wait a moment and try again.';
      case 'server': return 'The search service is having problems right now. Please try again shortly.';
      case 'bad-response': return 'The search service sent a response this app could not understand.';
      default: return 'The search request was rejected. Try simplifying your search.';
    }
  }
}

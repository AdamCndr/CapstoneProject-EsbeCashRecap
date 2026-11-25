import ClientError from './ClientError.js';

/**
 * Error pembatasan laju permintaan / rate limiting (HTTP 429).
 */
class TooManyRequestsError extends ClientError {
  constructor(message, code = 'RATE_LIMIT_EXCEEDED', details = {}) {
    super(message, 429, code, details);
    this.name = 'TooManyRequestsError';
  }
}

export default TooManyRequestsError;

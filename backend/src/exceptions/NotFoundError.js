import ClientError from './ClientError.js';

/**
 * Error ketika resource yang diminta tidak ditemukan (HTTP 404).
 */
class NotFoundError extends ClientError {
  constructor(message, code = 'NOT_FOUND', details = {}) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}

export default NotFoundError;

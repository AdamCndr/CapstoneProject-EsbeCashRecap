import ClientError from './ClientError.js';

/**
 * Error ketika ukuran file melebihi batas yang diizinkan (HTTP 413).
 */
class PayloadTooLargeError extends ClientError {
  constructor(message, code = 'FILE_TOO_LARGE', details = {}) {
    super(message, 413, code, details);
    this.name = 'PayloadTooLargeError';
  }
}

export default PayloadTooLargeError;

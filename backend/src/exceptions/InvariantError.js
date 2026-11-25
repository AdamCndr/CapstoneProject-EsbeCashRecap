import ClientError from './ClientError.js';

/**
 * Error validasi input atau pelanggaran aturan bisnis (HTTP 400).
 */
class InvariantError extends ClientError {
  constructor(message, code = 'VALIDATION_ERROR', details = {}) {
    super(message, 400, code, details);
    this.name = 'InvariantError';
  }
}

export default InvariantError;

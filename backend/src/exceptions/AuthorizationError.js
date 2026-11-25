import ClientError from './ClientError.js';

/**
 * Error otorisasi ketika akun non-aktif atau role tidak memiliki izin (HTTP 403).
 */
class AuthorizationError extends ClientError {
  constructor(message, code = 'FORBIDDEN', details = {}) {
    super(message, 403, code, details);
    this.name = 'AuthorizationError';
  }
}

export default AuthorizationError;

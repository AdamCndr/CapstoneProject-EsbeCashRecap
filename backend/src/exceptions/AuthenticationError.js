import ClientError from './ClientError.js';

/**
 * Error autentikasi ketika kredensial atau token tidak valid (HTTP 401).
 */
class AuthenticationError extends ClientError {
  constructor(message, code = 'AUTHENTICATION_ERROR', details = {}) {
    super(message, 401, code, details);
    this.name = 'AuthenticationError';
  }
}

export default AuthenticationError;

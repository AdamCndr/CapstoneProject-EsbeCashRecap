import ClientError from './ClientError.js';

/**
 * Error ketika tipe media / format file tidak didukung (HTTP 415).
 */
class UnsupportedMediaTypeError extends ClientError {
  constructor(message, code = 'UNSUPPORTED_MEDIA_TYPE', details = {}) {
    super(message, 415, code, details);
    this.name = 'UnsupportedMediaTypeError';
  }
}

export default UnsupportedMediaTypeError;

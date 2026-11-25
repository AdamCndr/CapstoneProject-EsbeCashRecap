/**
 * Base class untuk error sisi klien (4xx) mengikuti pola Dicoding Fundamental Back-End.
 */
class ClientError extends Error {
  /**
   * @param {string} message - Pesan error yang aman ditampilkan ke klien.
   * @param {number} [statusCode=400] - HTTP status code.
   * @param {string} [code='CLIENT_ERROR'] - Kode error mesin-terbaca.
   * @param {Record<string, unknown>} [details={}] - Detail tambahan error.
   */
  constructor(message, statusCode = 400, code = 'CLIENT_ERROR', details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ClientError';
  }
}

export default ClientError;

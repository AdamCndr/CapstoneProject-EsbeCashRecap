import TooManyRequestsError from '../exceptions/TooManyRequestsError.js';

/**
 * Membuat Express middleware rate limiter sederhana berbasis memori per alamat IP.
 *
 * CATATAN: Di Vercel Serverless setiap instance memori terpisah, sehingga counter
 * tidak konsisten antar concurrent invocation. Untuk produksi ketat gunakan
 * store eksternal (misalnya Upstash Redis). Untuk tahap Capstone ini sudah cukup.
 *
 * @param {{ windowMs?: number, maxAttempts?: number }} [options]
 * @returns {import('express').RequestHandler}
 */
export function createLoginRateLimiter({ windowMs = 60000, maxAttempts = 10 } = {}) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const attemptsByIp = new Map();

  /**
   * Express middleware — dipanggil sebelum handler login.
   */
  const middleware = (req, res, next) => {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    const clientIp =
      (typeof forwardedFor === 'string' && forwardedFor.split(',')[0].trim()) ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = attemptsByIp.get(clientIp);

    if (!record || now >= record.resetAt) {
      attemptsByIp.set(clientIp, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;

    if (record.count > maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return next(
        new TooManyRequestsError(
          'Terlalu banyak percobaan login. Silakan coba beberapa saat lagi.',
          'RATE_LIMIT_EXCEEDED',
          { retryAfterSeconds },
        ),
      );
    }

    return next();
  };

  /** Reset semua counter (berguna untuk testing). */
  middleware.reset = () => attemptsByIp.clear();

  return middleware;
}

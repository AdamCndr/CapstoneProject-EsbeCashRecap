import TooManyRequestsError from '../exceptions/TooManyRequestsError.js';

/**
 * Membuat Hapi pre-handler rate limiter sederhana berbasis memori per alamat IP.
 *
 * @param {{ windowMs?: number, maxAttempts?: number }} [options]
 * @returns {{ handler: (request: import('@hapi/hapi').Request, h: import('@hapi/hapi').ResponseToolkit) => symbol, reset: () => void }}
 */
export function createLoginRateLimiter({ windowMs = 60000, maxAttempts = 10 } = {}) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const attemptsByIp = new Map();

  const handler = (request, h) => {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const clientIp =
      (typeof forwardedFor === 'string' && forwardedFor.split(',')[0].trim()) ||
      request.info?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = attemptsByIp.get(clientIp);

    if (!record || now >= record.resetAt) {
      attemptsByIp.set(clientIp, { count: 1, resetAt: now + windowMs });
      return h.continue;
    }

    record.count += 1;

    if (record.count > maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      throw new TooManyRequestsError(
        'Terlalu banyak percobaan login. Silakan coba beberapa saat lagi.',
        'RATE_LIMIT_EXCEEDED',
        { retryAfterSeconds },
      );
    }

    return h.continue;
  };

  const reset = () => {
    attemptsByIp.clear();
  };

  return { handler, reset };
}

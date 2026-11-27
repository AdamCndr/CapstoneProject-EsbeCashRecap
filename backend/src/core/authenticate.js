import TokenManager from '../tokenize/TokenManager.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';

/**
 * Express middleware: membaca header Authorization, memverifikasi JWT,
 * dan menyimpan payload ke req.user agar handler bisa membacanya.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AuthenticationError(
        'Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.',
        'UNAUTHORIZED',
      ),
    );
  }

  const token = authHeader.slice(7); // hapus "Bearer "
  try {
    const decoded = TokenManager.verifyAccessToken(token);
    req.user = decoded; // { id, username, role, full_name, iat, exp }
    return next();
  } catch (err) {
    return next(err);
  }
}

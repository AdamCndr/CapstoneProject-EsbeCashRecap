import AuthenticationError from '../exceptions/AuthenticationError.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';

/**
 * Pemetaan alias role agar kompatibel antara skema awal ('admin'/'operator')
 * dan penamaan domain bisnis ('owner'/'employee').
 */
const ROLE_ALIASES = {
  owner: ['owner', 'admin'],
  admin: ['owner', 'admin'],
  employee: ['employee', 'operator'],
  operator: ['employee', 'operator'],
};

/**
 * Memeriksa apakah role pengguna memenuhi salah satu role yang diizinkan.
 *
 * @param {string} userRole
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function hasAllowedRole(userRole, allowedRoles) {
  const normalizedUserRole = String(userRole || '').toLowerCase();
  const userEquivalents = ROLE_ALIASES[normalizedUserRole] || [normalizedUserRole];

  return allowedRoles.some((role) => {
    const normalizedTarget = String(role || '').toLowerCase();
    return userEquivalents.includes(normalizedTarget);
  });
}

/**
 * Factory Express middleware untuk membatasi akses route berdasarkan role.
 *
 * Contoh penggunaan:
 *   router.get('/recap', authenticate, requireRole('owner'), handler);
 *
 * @param {...string} allowedRoles - Daftar role yang diizinkan mengakses endpoint.
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const credentials = req.user;

    if (!credentials || !credentials.role) {
      return next(new AuthenticationError('Autentikasi diperlukan', 'UNAUTHORIZED'));
    }

    if (!hasAllowedRole(credentials.role, allowedRoles)) {
      return next(
        new AuthorizationError(
          'Anda tidak memiliki hak akses untuk fitur ini',
          'FORBIDDEN',
          {
            requiredRoles: allowedRoles,
            currentRole: credentials.role,
          },
        ),
      );
    }

    return next();
  };
}

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
 * Factory Hapi pre-handler untuk membatasi akses route berdasarkan role.
 * Contoh penggunaan pada route:
 *   options: { auth: 'esbe_jwt', pre: [{ method: requireRole('owner') }] }
 *
 * @param {...string} allowedRoles - Daftar role yang diizinkan mengakses endpoint.
 * @returns {(request: import('@hapi/hapi').Request, h: import('@hapi/hapi').ResponseToolkit) => symbol}
 */
export function requireRole(...allowedRoles) {
  return (request, h) => {
    const credentials = request.auth?.credentials;

    if (!credentials || !credentials.role) {
      throw new AuthenticationError('Autentikasi diperlukan', 'UNAUTHORIZED');
    }

    if (!hasAllowedRole(credentials.role, allowedRoles)) {
      throw new AuthorizationError(
        'Anda tidak memiliki hak akses untuk fitur ini',
        'FORBIDDEN',
        {
          requiredRoles: allowedRoles,
          currentRole: credentials.role,
        },
      );
    }

    return h.continue;
  };
}

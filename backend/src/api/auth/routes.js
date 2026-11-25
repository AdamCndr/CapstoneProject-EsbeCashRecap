import { requireRole } from '../../core/authorize.js';

/**
 * Definisi route untuk plugin autentikasi.
 *
 * @param {import('./handler.js').default} handler
 * @param {(request: import('@hapi/hapi').Request, h: import('@hapi/hapi').ResponseToolkit) => symbol} loginRateLimiter
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler, loginRateLimiter) => [
  {
    method: 'POST',
    path: '/auth/login',
    options: {
      auth: false,
      pre: loginRateLimiter ? [{ method: loginRateLimiter }] : [],
    },
    handler: handler.postLoginHandler,
  },
  {
    method: 'GET',
    path: '/auth/me',
    options: {
      auth: 'esbe_jwt',
    },
    handler: handler.getMeHandler,
  },
  {
    method: 'GET',
    path: '/auth/owner-only',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.getOwnerOnlyHandler,
  },
];

export default routes;

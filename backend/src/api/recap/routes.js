import { requireRole } from '../../core/authorize.js';

/**
 * Definisi route untuk plugin rekap (/recap).
 * Hanya dapat diakses oleh role owner.
 *
 * @param {import('./handler.js').default} handler
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler) => [
  {
    method: 'GET',
    path: '/recap',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.getRecapHandler,
  },
];

export default routes;

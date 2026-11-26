import { requireRole } from '../../core/authorize.js';

/**
 * Definisi route untuk plugin dashboard (/dashboard/*).
 * Hanya dapat diakses oleh role owner.
 *
 * @param {import('./handler.js').default} handler
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler) => [
  {
    method: 'GET',
    path: '/dashboard/summary',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.getDashboardSummaryHandler,
  },
];

export default routes;

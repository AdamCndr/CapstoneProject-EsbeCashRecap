import { requireRole } from '../../core/authorize.js';

/**
 * Definisi route manajemen akun (/users/*) — hanya dapat diakses owner.
 *
 * @param {import('./handler.js').default} handler
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler) => [
  {
    method: 'GET',
    path: '/users',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.getUsersHandler,
  },
  {
    method: 'POST',
    path: '/users',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.postUserHandler,
  },
  {
    method: 'PUT',
    path: '/users/{id}',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.putUserHandler,
  },
  {
    method: 'PATCH',
    path: '/users/{id}',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.putUserHandler,
  },
  {
    method: 'DELETE',
    path: '/users/{id}',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.deleteUserHandler,
  },
];

export default routes;

import { requireRole } from '../../core/authorize.js';
import { MAX_PROOF_FILE_BYTES } from '../../validator/transactions/index.js';

/**
 * Definisi route untuk plugin transaksi (/transactions/*).
 *
 * @param {import('./handler.js').default} handler
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler) => [
  /* ---- Mock extract (sudah ada) ---- */
  {
    method: 'POST',
    path: '/transactions/extract',
    options: {
      auth: 'esbe_jwt',
      payload: {
        output: 'stream',
        parse: true,
        multipart: true,
        maxBytes: MAX_PROOF_FILE_BYTES,
        allow: 'multipart/form-data',
      },
    },
    handler: handler.postExtractTransactionHandler,
  },

  /* ---- POST /transactions/cash ---- */
  {
    method: 'POST',
    path: '/transactions/cash',
    options: {
      auth: 'esbe_jwt',
      // Semua user yang terautentikasi boleh membuat transaksi tunai
    },
    handler: handler.postCashTransactionHandler,
  },

  /* ---- POST /transactions (konfirmasi / simpan) ---- */
  {
    method: 'POST',
    path: '/transactions',
    options: {
      auth: 'esbe_jwt',
    },
    handler: handler.postConfirmTransactionHandler,
  },

  /* ---- GET /transactions (list + filter + paginasi) ---- */
  {
    method: 'GET',
    path: '/transactions',
    options: {
      auth: 'esbe_jwt',
    },
    handler: handler.getTransactionsHandler,
  },

  /* ---- GET /transactions/{id} ---- */
  {
    method: 'GET',
    path: '/transactions/{id}',
    options: {
      auth: 'esbe_jwt',
    },
    handler: handler.getTransactionByIdHandler,
  },

  /* ---- PATCH /transactions/{id} (owner only) ---- */
  {
    method: 'PATCH',
    path: '/transactions/{id}',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.patchTransactionHandler,
  },

  /* ---- DELETE /transactions/{id} (owner only) ---- */
  {
    method: 'DELETE',
    path: '/transactions/{id}',
    options: {
      auth: 'esbe_jwt',
      pre: [{ method: requireRole('owner') }],
    },
    handler: handler.deleteTransactionHandler,
  },
];

export default routes;

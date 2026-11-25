import { MAX_PROOF_FILE_BYTES } from '../../validator/transactions/index.js';

/**
 * Definisi route untuk plugin transaksi (/transactions/*).
 *
 * @param {import('./handler.js').default} handler
 * @returns {Array<import('@hapi/hapi').ServerRoute>}
 */
const routes = (handler) => [
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
];

export default routes;

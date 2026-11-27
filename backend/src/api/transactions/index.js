import { Router } from 'express';
import multer from 'multer';
import TransactionsHandler from './handler.js';
import { authenticate } from '../../core/authenticate.js';
import { requireRole } from '../../core/authorize.js';
import TransactionService from '../../services/TransactionService.js';
import TransactionsValidator from '../../validator/transactions/index.js';
import { MAX_PROOF_FILE_BYTES } from '../../validator/transactions/index.js';

/**
 * multer — simpan file di memori (buffer) agar bisa diteruskan ke Supabase Storage.
 * Batas ukuran diset sama dengan MAX_PROOF_FILE_BYTES (5 MB).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_FILE_BYTES },
});

/**
 * Express Router untuk modul transaksi (/transactions/*).
 */
export function createTransactionsRouter({
  service = new TransactionService(),
  validator = TransactionsValidator,
} = {}) {
  const router = Router();
  const handler = new TransactionsHandler({ service, validator });

  // POST /transactions/extract — butuh JWT + upload file
  router.post(
    '/extract',
    authenticate,
    upload.single('file'),
    handler.postExtractTransactionHandler,
  );

  // POST /transactions/cash — butuh JWT, semua user
  router.post('/cash', authenticate, handler.postCashTransactionHandler);

  // POST /transactions — butuh JWT, semua user
  router.post('/', authenticate, handler.postConfirmTransactionHandler);

  // GET /transactions — butuh JWT
  router.get('/', authenticate, handler.getTransactionsHandler);

  // GET /transactions/:id — butuh JWT
  router.get('/:id', authenticate, handler.getTransactionByIdHandler);

  // PATCH /transactions/:id — butuh JWT + role owner
  router.patch('/:id', authenticate, requireRole('owner'), handler.patchTransactionHandler);

  // DELETE /transactions/:id — butuh JWT + role owner
  router.delete('/:id', authenticate, requireRole('owner'), handler.deleteTransactionHandler);

  return router;
}

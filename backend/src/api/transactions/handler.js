import crypto from 'node:crypto';
import path from 'node:path';
import InvariantError from '../../exceptions/InvariantError.js';
import PayloadTooLargeError from '../../exceptions/PayloadTooLargeError.js';
import { MAX_PROOF_FILE_BYTES } from '../../validator/transactions/index.js';

/**
 * Menentukan shift default berdasarkan jam lokal WIB.
 */
function inferCurrentShift() {
  const wibHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );

  return wibHour >= 6 && wibHour < 14 ? 'pagi' : 'siang';
}

/**
 * Membangun payload dummy sesuai kontrak POST /transactions/extract.
 */
function buildMockExtractPayload({ scenario, shift, paymentMethod, proofMeta }) {
  const baseDate = '2026-11-25';
  const baseTime = '11:35:00';
  const resolvedShift = shift || inferCurrentShift();
  const resolvedMethod = paymentMethod || 'qris';

  if (scenario === 'ai_fallback') {
    return {
      message: 'Layanan AI tidak merespons tepat waktu. Silakan isi data transaksi secara manual.',
      data: {
        is_mock: true,
        manual_input_required: true,
        ai_status: 'timeout',
        fallback_reason: {
          code: 'AI_TIMEOUT',
          message: 'Ekstraksi otomatis melebihi batas waktu 30 detik (sudah dicoba ulang 1x).',
        },
        proof: { ...proofMeta, image_phash: null },
        extraction: null,
        duplicate_check: {
          is_duplicate: false, severity: 'none',
          warning_title: null, warning_message: null, matches: [],
        },
        draft: {
          payment_proof_id: proofMeta.proof_id,
          title: 'Pembayaran non-tunai',
          transaction_type: 'pemasukan',
          payment_method: resolvedMethod,
          shift: resolvedShift,
          amount: null,
          transaction_date: baseDate,
          transaction_time: null,
          transaction_reference: null,
          is_duplicate: false,
        },
      },
    };
  }

  if (scenario === 'partial') {
    return {
      message: 'Bukti diproses dengan beberapa field tidak terbaca',
      data: {
        is_mock: true,
        manual_input_required: false,
        ai_status: 'partial',
        fallback_reason: null,
        proof: { ...proofMeta, image_phash: '8f12c34a7b910e22' },
        extraction: {
          amount: 75000, transaction_time: null, transaction_id: null,
          source: 'transfer',
          confidence: { amount: 0.89, transaction_time: 0.0, transaction_id: 0.0, source: 0.85 },
          method_used: 'llm_fallback',
          warnings: ['UNREADABLE_TIME', 'UNREADABLE_TRANSACTION_ID'],
        },
        duplicate_check: {
          is_duplicate: false, severity: 'none',
          warning_title: null, warning_message: null, matches: [],
        },
        draft: {
          payment_proof_id: proofMeta.proof_id,
          title: 'Pembayaran Transfer Bank',
          transaction_type: 'pemasukan',
          payment_method: paymentMethod || 'transfer',
          shift: resolvedShift,
          amount: 75000,
          transaction_date: baseDate,
          transaction_time: null,
          transaction_reference: null,
          is_duplicate: false,
        },
      },
    };
  }

  const isDuplicate = scenario === 'duplicate';

  return {
    message: isDuplicate
      ? 'Bukti diproses dengan peringatan duplikat'
      : 'Bukti pembayaran berhasil diproses',
    data: {
      is_mock: true,
      manual_input_required: false,
      ai_status: 'success',
      fallback_reason: null,
      proof: { ...proofMeta, image_phash: 'a4d3c2b1e0f98765' },
      extraction: {
        amount: 145000,
        transaction_time: `${baseDate}T${baseTime}+07:00`,
        transaction_id: 'NMID-992144812',
        source: 'QRIS',
        confidence: { amount: 0.98, transaction_time: 0.94, transaction_id: 0.91, source: 0.99 },
        method_used: 'ocr',
        warnings: [],
      },
      duplicate_check: isDuplicate
        ? {
            is_duplicate: true, severity: 'high',
            warning_title: 'Bukti terindikasi duplikat',
            warning_message:
              'ID transaksi NMID-992144812 dengan nominal Rp 145.000 cocok dengan transaksi #42. Anda tetap dapat menyimpan transaksi dengan status Perlu ditinjau.',
            matches: [{
              matched_transaction_id: 42, match_method: 'reference_exact',
              similarity_score: 98.0, matched_amount: 145000,
              matched_date: baseDate, matched_time: baseTime,
              matched_reference: 'NMID-992144812',
            }],
          }
        : {
            is_duplicate: false, severity: 'none',
            warning_title: null, warning_message: null, matches: [],
          },
      draft: {
        payment_proof_id: proofMeta.proof_id,
        title: 'Pembayaran QRIS',
        transaction_type: 'pemasukan',
        payment_method: resolvedMethod,
        shift: resolvedShift,
        amount: 145000,
        transaction_date: baseDate,
        transaction_time: baseTime,
        transaction_reference: 'NMID-992144812',
        is_duplicate: isDuplicate,
      },
    },
  };
}

/**
 * Handler endpoint transaksi (CRUD + mock extract).
 * Versi Express — req.user menggantikan request.auth.credentials Hapi.
 * req.file (dari multer) menggantikan request.payload.file (Hapi stream).
 */
class TransactionsHandler {
  /**
   * @param {{ service: import('../../services/TransactionService.js').default, validator: Object }} deps
   */
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.postExtractTransactionHandler = this.postExtractTransactionHandler.bind(this);
    this.postCashTransactionHandler = this.postCashTransactionHandler.bind(this);
    this.postConfirmTransactionHandler = this.postConfirmTransactionHandler.bind(this);
    this.getTransactionsHandler = this.getTransactionsHandler.bind(this);
    this.getTransactionByIdHandler = this.getTransactionByIdHandler.bind(this);
    this.patchTransactionHandler = this.patchTransactionHandler.bind(this);
    this.deleteTransactionHandler = this.deleteTransactionHandler.bind(this);
  }

  /* ================================================================
   * POST /transactions/extract  (mock)
   * Menerima multipart/form-data via multer (req.file + req.body).
   * ================================================================ */
  async postExtractTransactionHandler(req, res, next) {
    try {
      // Metadata dari form-data fields
      const { shift, payment_method: paymentMethod, mock_scenario: mockScenario } =
        this._validator.validateExtractMetadata(req.body);

      // Validasi file — req.file di-set oleh multer middleware
      const { filename, mimeType, buffer } = this._validator.validateProofFile(req.file);

      if (buffer.length === 0) {
        throw new InvariantError('File gambar bukti kosong atau tidak valid', 'INVALID_IMAGE', {
          fields: [{ field: 'file', message: 'File tidak boleh kosong (0 byte)' }],
        });
      }

      if (buffer.length > MAX_PROOF_FILE_BYTES) {
        throw new PayloadTooLargeError(
          'Ukuran file bukti melebihi batas maksimal 5 MB',
          'FILE_TOO_LARGE',
          { maxBytes: MAX_PROOF_FILE_BYTES },
        );
      }

      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const ext = path.extname(filename) || '.jpg';
      const proofMeta = {
        proof_id: 501,
        storage_key: `proofs/2026/11/25/mock-proof-${sha256Hash.slice(0, 8)}${ext}`,
        original_filename: filename,
        mime_type: mimeType,
        file_size: buffer.length,
        sha256_hash: sha256Hash,
      };

      const mockResult = buildMockExtractPayload({
        scenario: mockScenario, shift, paymentMethod, proofMeta,
      });

      return res.status(200).json({
        status: 'success',
        message: mockResult.message,
        data: mockResult.data,
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * POST /transactions/cash
   * ================================================================ */
  async postCashTransactionHandler(req, res, next) {
    try {
      const validated = this._validator.validateCashTransaction(req.body);
      const user = req.user;

      const { transaction, isIdempotent } = await this._service.createTransaction(
        { ...validated, payment_method: 'tunai' },
        user,
      );

      const statusCode = isIdempotent ? 200 : 201;
      const message = isIdempotent
        ? 'Transaksi sudah tercatat sebelumnya (idempotent)'
        : 'Transaksi tunai berhasil disimpan';

      return res.status(statusCode).json({
        status: 'success',
        message,
        data: { transaction },
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * POST /transactions  (konfirmasi / simpan)
   * ================================================================ */
  async postConfirmTransactionHandler(req, res, next) {
    try {
      const validated = this._validator.validateConfirmTransaction(req.body);
      const user = req.user;

      const { transaction, isIdempotent } = await this._service.createTransaction(validated, user);

      const statusCode = isIdempotent ? 200 : 201;
      const message = isIdempotent
        ? 'Transaksi sudah tercatat sebelumnya (idempotent)'
        : 'Transaksi berhasil disimpan';

      return res.status(statusCode).json({
        status: 'success',
        message,
        data: { transaction },
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * GET /transactions
   * ================================================================ */
  async getTransactionsHandler(req, res, next) {
    try {
      const filters = this._validator.validateTransactionQuery(req.query);
      const user = req.user;

      const result = await this._service.getTransactions(filters, user);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * GET /transactions/:id
   * ================================================================ */
  async getTransactionByIdHandler(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      const transaction = await this._service.getTransactionById(Number(id), user);

      return res.status(200).json({
        status: 'success',
        data: { transaction },
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * PATCH /transactions/:id  (owner only)
   * ================================================================ */
  async patchTransactionHandler(req, res, next) {
    try {
      const { id } = req.params;
      const validated = this._validator.validateUpdateTransaction(req.body);
      const user = req.user;

      const transaction = await this._service.updateTransaction(Number(id), validated, user);

      return res.status(200).json({
        status: 'success',
        message: 'Transaksi berhasil diperbarui',
        data: { transaction },
      });
    } catch (err) {
      return next(err);
    }
  }

  /* ================================================================
   * DELETE /transactions/:id  (owner only)
   * ================================================================ */
  async deleteTransactionHandler(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      await this._service.deleteTransaction(Number(id), user);

      return res.status(200).json({
        status: 'success',
        message: 'Transaksi berhasil dihapus',
      });
    } catch (err) {
      return next(err);
    }
  }
}

export default TransactionsHandler;

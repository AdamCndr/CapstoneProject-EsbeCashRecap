import path from 'node:path';
import InvariantError from '../../exceptions/InvariantError.js';
import UnsupportedMediaTypeError from '../../exceptions/UnsupportedMediaTypeError.js';
import {
  ExtractTransactionMetadataSchema,
  CashTransactionSchema,
  ConfirmTransactionSchema,
  UpdateTransactionSchema,
  TransactionQuerySchema,
} from './schema.js';

export const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PROOF_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Helper: jalankan validasi Joi dan lempar InvariantError jika gagal.
 */
function runValidation(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const fields = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new InvariantError(
      fields.map((item) => item.message).join('; '),
      'VALIDATION_ERROR',
      { fields },
    );
  }

  return value;
}

/**
 * Validator untuk seluruh endpoint transaksi.
 */
const TransactionsValidator = {
  /**
   * Validasi metadata POST /transactions/extract (mock).
   */
  validateExtractMetadata(body) {
    const metadata = {
      shift: body?.shift || undefined,
      payment_method: body?.payment_method || undefined,
      mock_scenario: body?.mock_scenario || undefined,
    };
    return runValidation(ExtractTransactionMetadataSchema, metadata);
  },

  /**
   * Validasi file upload dari multer (req.file).
   * Menggantikan validateProofFileStream yang bergantung pada Hapi stream object.
   *
   * @param {Express.Multer.File | undefined} file - Object req.file dari multer.
   * @returns {{ filename: string, mimeType: string, buffer: Buffer }}
   */
  validateProofFile(file) {
    if (!file) {
      throw new InvariantError(
        'File bukti pembayaran wajib diunggah pada field "file"',
        'VALIDATION_ERROR',
        {
          fields: [{ field: 'file', message: 'File bukti pembayaran wajib diunggah' }],
        },
      );
    }

    const filename = file.originalname || 'unknown';
    const mimeType = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    const ext = path.extname(filename).toLowerCase();

    const isMimeAllowed = ALLOWED_PROOF_MIME_TYPES.includes(mimeType);
    const isExtAllowed = !ext || ALLOWED_PROOF_EXTENSIONS.includes(ext);

    if (!isMimeAllowed || !isExtAllowed) {
      throw new UnsupportedMediaTypeError(
        'Format file tidak didukung. Unggah gambar JPG, PNG, atau WEBP.',
        'UNSUPPORTED_MEDIA_TYPE',
        {
          allowedMimeTypes: ALLOWED_PROOF_MIME_TYPES,
          receivedMimeType: mimeType || 'unknown',
        },
      );
    }

    return { filename, mimeType, buffer: file.buffer };
  },

  /**
   * Validasi POST /transactions/cash — transaksi tunai.
   */
  validateCashTransaction(payload) {
    return runValidation(CashTransactionSchema, payload);
  },

  /**
   * Validasi POST /transactions — konfirmasi/simpan transaksi.
   * Aturan tambahan: non-tunai wajib ada payment_proof_id atau is_manual_input.
   */
  validateConfirmTransaction(payload) {
    const value = runValidation(ConfirmTransactionSchema, payload);

    if (value.payment_method !== 'tunai') {
      if (!value.payment_proof_id && !value.is_manual_input) {
        throw new InvariantError(
          'Transaksi non-tunai wajib memiliki bukti pembayaran (payment_proof_id) atau ditandai sebagai input manual (is_manual_input = true)',
          'VALIDATION_ERROR',
          {
            fields: [
              { field: 'payment_proof_id', message: 'Bukti pembayaran wajib untuk non-tunai' },
              { field: 'is_manual_input', message: 'Atau tandai sebagai input manual' },
            ],
          },
        );
      }
    }

    return value;
  },

  /**
   * Validasi PATCH /transactions/:id — update transaksi.
   */
  validateUpdateTransaction(payload) {
    return runValidation(UpdateTransactionSchema, payload);
  },

  /**
   * Validasi query GET /transactions — filter dan paginasi.
   */
  validateTransactionQuery(query) {
    return runValidation(TransactionQuerySchema, query);
  },
};

export default TransactionsValidator;

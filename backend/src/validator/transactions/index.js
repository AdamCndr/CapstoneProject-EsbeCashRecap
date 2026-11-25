import path from 'node:path';
import InvariantError from '../../exceptions/InvariantError.js';
import UnsupportedMediaTypeError from '../../exceptions/UnsupportedMediaTypeError.js';
import { ExtractTransactionMetadataSchema } from './schema.js';

export const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PROOF_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validator untuk endpoint transaksi dan ekstraksi bukti pembayaran.
 */
const TransactionsValidator = {
  /**
   * Memvalidasi field metadata non-file pada request POST /transactions/extract.
   *
   * @param {Record<string, unknown>} payload
   * @returns {{ shift?: string, payment_method?: string, mock_scenario: string }}
   */
  validateExtractMetadata(payload) {
    const metadata = {
      shift: payload?.shift || undefined,
      payment_method: payload?.payment_method || undefined,
      mock_scenario: payload?.mock_scenario || undefined,
    };

    const { error, value } = ExtractTransactionMetadataSchema.validate(metadata, {
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
  },

  /**
   * Memvalidasi keberadaan file stream dan jenis media gambar (jpg/png/webp).
   *
   * @param {unknown} fileStream
   * @returns {{ filename: string, mimeType: string }}
   */
  validateProofFileStream(fileStream) {
    if (!fileStream || typeof fileStream.on !== 'function' || !fileStream.hapi) {
      throw new InvariantError(
        'File bukti pembayaran wajib diunggah pada field "file"',
        'VALIDATION_ERROR',
        {
          fields: [{ field: 'file', message: 'File bukti pembayaran wajib diunggah' }],
        },
      );
    }

    const filename = fileStream.hapi.filename || 'unknown';
    const rawMime = fileStream.hapi.headers?.['content-type'] || '';
    const mimeType = rawMime.split(';')[0].trim().toLowerCase();
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

    return { filename, mimeType };
  },
};

export default TransactionsValidator;

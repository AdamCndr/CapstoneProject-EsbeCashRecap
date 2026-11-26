import Joi from 'joi';

/* ================================================================
 * Schema validasi endpoint transaksi
 * ================================================================ */

/**
 * Schema metadata POST /transactions/extract (mock, sudah ada sebelumnya).
 */
export const ExtractTransactionMetadataSchema = Joi.object({
  shift: Joi.string().valid('pagi', 'siang').optional().messages({
    'any.only': 'Shift harus bernilai pagi atau siang',
  }),
  payment_method: Joi.string().valid('qris', 'transfer', 'tunai').optional().messages({
    'any.only': 'Metode pembayaran harus bernilai qris, transfer, atau tunai',
  }),
  mock_scenario: Joi.string()
    .valid('success', 'duplicate', 'partial', 'ai_fallback')
    .default('success')
    .messages({
      'any.only': 'mock_scenario harus bernilai success, duplicate, partial, atau ai_fallback',
    }),
});

/**
 * Schema POST /transactions/cash — transaksi tunai.
 *
 * Aturan:
 * - amount: integer > 0, tolak kosong/huruf/negatif/desimal
 * - shift: wajib, hanya 'pagi' | 'siang'
 * - payment_method: selalu 'tunai' (di-set otomatis oleh handler, tapi divalidasi)
 * - external_trx_id: TIDAK BOLEH ada untuk tunai
 */
export const CashTransactionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required().messages({
    'string.base': 'Judul transaksi harus berupa teks',
    'string.empty': 'Judul transaksi tidak boleh kosong',
    'string.min': 'Judul transaksi tidak boleh kosong',
    'string.max': 'Judul transaksi maksimal 255 karakter',
    'any.required': 'Judul transaksi wajib diisi',
  }),
  transaction_type: Joi.string().valid('pemasukan', 'pengeluaran').required().messages({
    'any.only': 'Tipe transaksi harus bernilai pemasukan atau pengeluaran',
    'any.required': 'Tipe transaksi wajib diisi',
  }),
  amount: Joi.number().integer().positive().required().messages({
    'number.base': 'Jumlah (amount) harus berupa angka',
    'number.integer': 'Jumlah (amount) harus berupa bilangan bulat tanpa desimal',
    'number.positive': 'Jumlah (amount) harus lebih besar dari 0',
    'any.required': 'Jumlah (amount) wajib diisi',
  }),
  shift: Joi.string().valid('pagi', 'siang').required().messages({
    'any.only': 'Shift harus bernilai pagi atau siang',
    'any.required': 'Shift wajib diisi',
  }),
  category_id: Joi.number().integer().positive().optional().allow(null).messages({
    'number.base': 'ID kategori harus berupa angka',
    'number.integer': 'ID kategori harus berupa bilangan bulat',
    'number.positive': 'ID kategori harus lebih besar dari 0',
  }),
  transaction_date: Joi.date().iso().optional().messages({
    'date.format': 'Tanggal transaksi harus dalam format ISO (YYYY-MM-DD)',
  }),
  trx_date: Joi.date().iso().optional().messages({
    'date.format': 'Tanggal transaksi (trx_date) harus dalam format ISO (YYYY-MM-DD)',
  }),
  transaction_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .messages({
      'string.pattern.base': 'Waktu transaksi harus dalam format HH:mm atau HH:mm:ss',
    }),
  notes: Joi.string().trim().max(1000).optional().allow('', null).messages({
    'string.max': 'Catatan maksimal 1000 karakter',
  }),
  idempotency_key: Joi.string().trim().max(255).optional().messages({
    'string.max': 'Idempotency key maksimal 255 karakter',
  }),
  // Status ditentukan oleh server, tidak boleh dikirim klien
  status: Joi.any().forbidden().messages({
    'any.unknown': 'Status transaksi ditentukan oleh server dan tidak boleh dikirim',
  }),
  transaction_status: Joi.any().forbidden().messages({
    'any.unknown': 'Status transaksi ditentukan oleh server dan tidak boleh dikirim',
  }),
  // Tunai TIDAK BOLEH punya external_trx_id
  external_trx_id: Joi.any().forbidden().messages({
    'any.unknown': 'Transaksi tunai tidak boleh memiliki external_trx_id',
  }),
}).options({ abortEarly: false });

/**
 * Schema POST /transactions — konfirmasi/simpan transaksi (QRIS/transfer atau manual).
 *
 * Aturan:
 * - amount: integer > 0
 * - payment_method: 'qris' | 'transfer' | 'tunai'
 * - Untuk non-tunai: wajib ada payment_proof_id ATAU is_manual_input = true
 */
export const ConfirmTransactionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required().messages({
    'string.base': 'Judul transaksi harus berupa teks',
    'string.empty': 'Judul transaksi tidak boleh kosong',
    'string.min': 'Judul transaksi tidak boleh kosong',
    'string.max': 'Judul transaksi maksimal 255 karakter',
    'any.required': 'Judul transaksi wajib diisi',
  }),
  transaction_type: Joi.string().valid('pemasukan', 'pengeluaran').required().messages({
    'any.only': 'Tipe transaksi harus bernilai pemasukan atau pengeluaran',
    'any.required': 'Tipe transaksi wajib diisi',
  }),
  amount: Joi.number().integer().positive().required().messages({
    'number.base': 'Jumlah (amount) harus berupa angka',
    'number.integer': 'Jumlah (amount) harus berupa bilangan bulat tanpa desimal',
    'number.positive': 'Jumlah (amount) harus lebih besar dari 0',
    'any.required': 'Jumlah (amount) wajib diisi',
  }),
  shift: Joi.string().valid('pagi', 'siang').required().messages({
    'any.only': 'Shift harus bernilai pagi atau siang',
    'any.required': 'Shift wajib diisi',
  }),
  payment_method: Joi.string().valid('tunai', 'qris', 'transfer').required().messages({
    'any.only': 'Metode pembayaran harus bernilai tunai, qris, atau transfer',
    'any.required': 'Metode pembayaran wajib diisi',
  }),
  category_id: Joi.number().integer().positive().optional().allow(null).messages({
    'number.base': 'ID kategori harus berupa angka',
    'number.integer': 'ID kategori harus berupa bilangan bulat',
    'number.positive': 'ID kategori harus lebih besar dari 0',
  }),
  transaction_date: Joi.date().iso().optional().messages({
    'date.format': 'Tanggal transaksi harus dalam format ISO (YYYY-MM-DD)',
  }),
  trx_date: Joi.date().iso().optional().messages({
    'date.format': 'Tanggal transaksi (trx_date) harus dalam format ISO (YYYY-MM-DD)',
  }),
  transaction_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .messages({
      'string.pattern.base': 'Waktu transaksi harus dalam format HH:mm atau HH:mm:ss',
    }),
  notes: Joi.string().trim().max(1000).optional().allow('', null).messages({
    'string.max': 'Catatan maksimal 1000 karakter',
  }),
  external_trx_id: Joi.string().trim().max(100).optional().allow(null).messages({
    'string.max': 'External transaction ID maksimal 100 karakter',
  }),
  payment_proof_id: Joi.number().integer().positive().optional().allow(null).messages({
    'number.base': 'ID bukti pembayaran harus berupa angka',
    'number.integer': 'ID bukti pembayaran harus berupa bilangan bulat',
    'number.positive': 'ID bukti pembayaran harus lebih besar dari 0',
  }),
  is_manual_input: Joi.boolean().optional().default(false).messages({
    'boolean.base': 'is_manual_input harus berupa boolean (true/false)',
  }),
  is_duplicate: Joi.boolean().optional().default(false).messages({
    'boolean.base': 'is_duplicate harus berupa boolean (true/false)',
  }),
  idempotency_key: Joi.string().trim().max(255).optional().messages({
    'string.max': 'Idempotency key maksimal 255 karakter',
  }),
  // Status ditentukan oleh server, tidak boleh dikirim klien
  status: Joi.any().forbidden().messages({
    'any.unknown': 'Status transaksi ditentukan oleh server dan tidak boleh dikirim',
  }),
  transaction_status: Joi.any().forbidden().messages({
    'any.unknown': 'Status transaksi ditentukan oleh server dan tidak boleh dikirim',
  }),
}).options({ abortEarly: false });

/**
 * Schema PATCH /transactions/{id} — update sebagian field (owner only).
 */
export const UpdateTransactionSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).optional().messages({
    'string.empty': 'Judul transaksi tidak boleh kosong',
    'string.max': 'Judul transaksi maksimal 255 karakter',
  }),
  transaction_type: Joi.string().valid('pemasukan', 'pengeluaran').optional().messages({
    'any.only': 'Tipe transaksi harus bernilai pemasukan atau pengeluaran',
  }),
  amount: Joi.number().integer().positive().optional().messages({
    'number.base': 'Jumlah (amount) harus berupa angka',
    'number.integer': 'Jumlah (amount) harus berupa bilangan bulat tanpa desimal',
    'number.positive': 'Jumlah (amount) harus lebih besar dari 0',
  }),
  shift: Joi.string().valid('pagi', 'siang').optional().messages({
    'any.only': 'Shift harus bernilai pagi atau siang',
  }),
  payment_method: Joi.string().valid('tunai', 'qris', 'transfer').optional().messages({
    'any.only': 'Metode pembayaran harus bernilai tunai, qris, atau transfer',
  }),
  category_id: Joi.number().integer().positive().optional().allow(null).messages({
    'number.base': 'ID kategori harus berupa angka',
  }),
  transaction_date: Joi.date().iso().optional().messages({
    'date.format': 'Tanggal transaksi harus dalam format ISO (YYYY-MM-DD)',
  }),
  transaction_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional()
    .messages({
      'string.pattern.base': 'Waktu transaksi harus dalam format HH:mm atau HH:mm:ss',
    }),
  transaction_status: Joi.string()
    .valid('terkonfirmasi', 'perlu_ditinjau', 'ditolak', 'completed', 'pending_review', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status transaksi harus terkonfirmasi, perlu_ditinjau, ditolak, completed, pending_review, atau cancelled',
    }),
  notes: Joi.string().trim().max(1000).optional().allow('', null).messages({
    'string.max': 'Catatan maksimal 1000 karakter',
  }),
  is_duplicate: Joi.boolean().optional().messages({
    'boolean.base': 'is_duplicate harus berupa boolean',
  }),
}).options({ abortEarly: false }).min(1).messages({
  'object.min': 'Minimal satu field harus diisi untuk update',
});

/**
 * Schema query GET /transactions — filter dan paginasi.
 */
export const TransactionQuerySchema = Joi.object({
  date_from: Joi.date().iso().optional().messages({
    'date.format': 'date_from harus dalam format ISO (YYYY-MM-DD)',
  }),
  date_to: Joi.date().iso().optional().messages({
    'date.format': 'date_to harus dalam format ISO (YYYY-MM-DD)',
  }),
  shift: Joi.string().valid('pagi', 'siang').optional().messages({
    'any.only': 'Filter shift harus bernilai pagi atau siang',
  }),
  payment_method: Joi.string().valid('tunai', 'qris', 'transfer').optional().messages({
    'any.only': 'Filter metode pembayaran harus bernilai tunai, qris, atau transfer',
  }),
  status: Joi.string()
    .valid('terkonfirmasi', 'perlu_ditinjau', 'ditolak', 'completed', 'pending_review', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Filter status harus terkonfirmasi, perlu_ditinjau, ditolak, completed, pending_review, atau cancelled',
    }),
  transaction_type: Joi.string().valid('pemasukan', 'pengeluaran').optional().messages({
    'any.only': 'Filter tipe transaksi harus pemasukan atau pengeluaran',
  }),
  search: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Kata kunci pencarian maksimal 100 karakter',
  }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page harus berupa angka',
    'number.min': 'Page minimal 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'Limit harus berupa angka',
    'number.min': 'Limit minimal 1',
    'number.max': 'Limit maksimal 100',
  }),
}).options({ abortEarly: false });

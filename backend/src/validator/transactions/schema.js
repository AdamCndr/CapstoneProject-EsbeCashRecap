import Joi from 'joi';

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

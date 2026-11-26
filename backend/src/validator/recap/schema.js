import Joi from 'joi';

/**
 * Validasi tanggal format YYYY-MM-DD secara ketat tanpa konversi zona waktu.
 */
function isoDateStringValidator(value, helpers) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return helpers.error('date.format');
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    return helpers.error('date.invalid');
  }
  return value;
}

export const RecapQuerySchema = Joi.object({
  date_from: Joi.string().trim().custom(isoDateStringValidator).optional()
    .messages({
      'date.format': 'date_from harus dalam format YYYY-MM-DD',
      'date.invalid': 'date_from bukan tanggal kalender yang valid',
    }),
  date_to: Joi.string().trim().custom(isoDateStringValidator).optional()
    .messages({
      'date.format': 'date_to harus dalam format YYYY-MM-DD',
      'date.invalid': 'date_to bukan tanggal kalender yang valid',
    }),
  group_by: Joi.string().trim().default('date').messages({
    'string.base': 'group_by harus berupa teks',
    'string.empty': 'group_by tidak boleh kosong',
  }),
}).options({ abortEarly: false });

export const DashboardSummaryQuerySchema = Joi.object({
  date: Joi.string().trim().custom(isoDateStringValidator).optional()
    .messages({
      'date.format': 'Parameter date harus dalam format YYYY-MM-DD',
      'date.invalid': 'Parameter date bukan tanggal kalender yang valid',
    }),
}).options({ abortEarly: false });

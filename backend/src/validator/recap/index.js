import InvariantError from '../../exceptions/InvariantError.js';
import { RecapQuerySchema, DashboardSummaryQuerySchema } from './schema.js';

const GROUP_BY_ALIASES = {
  date: 'date',
  day: 'date',
  shift: 'shift',
  method: 'method',
  payment_method: 'method',
  category: 'category',
};

const VALID_GROUP_BY_TOKENS = Object.keys(GROUP_BY_ALIASES);

/**
 * Validator untuk endpoint GET /recap dan GET /dashboard/summary.
 */
const RecapValidator = {
  /**
   * Memvalidasi query GET /recap dan menormalkan group_by menjadi array unik dimensi SQL.
   *
   * @param {Record<string, unknown>} query
   * @returns {{ dateFrom?: string, dateTo?: string, groupBy: string[] }}
   */
  validateRecapQuery(query = {}) {
    const { error, value } = RecapQuerySchema.validate(query, {
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

    if (value.date_from && value.date_to && value.date_from > value.date_to) {
      throw new InvariantError(
        'Parameter date_from tidak boleh lebih besar dari date_to',
        'VALIDATION_ERROR',
        {
          fields: [
            { field: 'date_from', message: 'date_from harus <= date_to' },
            { field: 'date_to', message: 'date_to harus >= date_from' },
          ],
        },
      );
    }

    const rawTokens = value.group_by
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);

    if (rawTokens.length === 0) {
      throw new InvariantError(
        'Parameter group_by harus berisi minimal satu dimensi (date, shift, method, category)',
        'VALIDATION_ERROR',
        { fields: [{ field: 'group_by', message: 'group_by tidak boleh kosong' }] },
      );
    }

    const invalidTokens = rawTokens.filter((token) => !GROUP_BY_ALIASES[token]);
    if (invalidTokens.length > 0) {
      throw new InvariantError(
        `Nilai group_by tidak valid: ${invalidTokens.join(', ')}. Pilihan: ${VALID_GROUP_BY_TOKENS.join(', ')}`,
        'VALIDATION_ERROR',
        {
          fields: [
            {
              field: 'group_by',
              message: `Nilai group_by harus kombinasi dari date, shift, method, atau category`,
            },
          ],
        },
      );
    }

    const normalizedGroups = [...new Set(rawTokens.map((token) => GROUP_BY_ALIASES[token]))];

    return {
      dateFrom: value.date_from,
      dateTo: value.date_to,
      groupBy: normalizedGroups,
    };
  },

  /**
   * Memvalidasi query GET /dashboard/summary.
   *
   * @param {Record<string, unknown>} query
   * @returns {{ date?: string }}
   */
  validateDashboardQuery(query = {}) {
    const { error, value } = DashboardSummaryQuerySchema.validate(query, {
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

    return { date: value.date };
  },
};

export default RecapValidator;

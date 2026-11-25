import InvariantError from '../../exceptions/InvariantError.js';
import { LoginPayloadSchema } from './schema.js';

/**
 * Validator payload endpoint autentikasi menggunakan Joi.
 */
const AuthValidator = {
  /**
   * Memvalidasi payload login (username dan password).
   *
   * @param {unknown} payload
   * @returns {{ username: string, password: string }}
   */
  validateLoginPayload(payload) {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const { error, value } = LoginPayloadSchema.validate(safePayload);

    if (error) {
      const fields = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      const summaryMessage = fields.map((item) => item.message).join('; ');
      throw new InvariantError(summaryMessage, 'VALIDATION_ERROR', { fields });
    }

    return value;
  },
};

export default AuthValidator;

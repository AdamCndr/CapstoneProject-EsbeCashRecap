import InvariantError from '../../exceptions/InvariantError.js';
import { CreateUserPayloadSchema, UpdateUserPayloadSchema } from './schema.js';

function validateWithSchema(schema, payload) {
  const { error, value } = schema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const fields = error.details.map((detail) => ({
      field: detail.path.join('.') || 'payload',
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

const UsersValidator = {
  validateCreateUserPayload(payload) {
    return validateWithSchema(CreateUserPayloadSchema, payload);
  },

  validateUpdateUserPayload(payload) {
    return validateWithSchema(UpdateUserPayloadSchema, payload);
  },
};

export default UsersValidator;

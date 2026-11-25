import Joi from 'joi';

export const LoginPayloadSchema = Joi.object({
  username: Joi.string().trim().min(1).required().messages({
    'string.base': 'Username harus berupa teks',
    'string.empty': 'Username tidak boleh kosong',
    'string.min': 'Username tidak boleh kosong',
    'any.required': 'Username wajib diisi',
  }),
  password: Joi.string().min(1).required().messages({
    'string.base': 'Password harus berupa teks',
    'string.empty': 'Password tidak boleh kosong',
    'string.min': 'Password tidak boleh kosong',
    'any.required': 'Password wajib diisi',
  }),
}).options({ abortEarly: false });

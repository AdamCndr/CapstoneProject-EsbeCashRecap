import Joi from 'joi';

export const CreateUserPayloadSchema = Joi.object({
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(50)
    .pattern(/^[a-z0-9._-]+$/)
    .required()
    .messages({
      'string.base': 'Username harus berupa teks',
      'string.empty': 'Username wajib diisi',
      'string.min': 'Username minimal 3 karakter',
      'string.max': 'Username maksimal 50 karakter',
      'string.pattern.base': 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah (_), atau strip (-)',
      'any.required': 'Username wajib diisi',
    }),
  name: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Nama lengkap tidak boleh kosong',
    'string.max': 'Nama lengkap maksimal 100 karakter',
  }),
  fullname: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Nama lengkap tidak boleh kosong',
    'string.max': 'Nama lengkap maksimal 100 karakter',
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.base': 'Password harus berupa teks',
    'string.empty': 'Password wajib diisi',
    'string.min': 'Password minimal 6 karakter',
    'string.max': 'Password maksimal 100 karakter',
    'any.required': 'Password wajib diisi',
  }),
  role: Joi.string()
    .valid('owner', 'employee', 'Pemilik', 'Karyawan', 'admin', 'operator')
    .default('employee')
    .messages({
      'any.only': 'Role harus bernilai employee/Karyawan atau owner/Pemilik',
    }),
})
  .or('name', 'fullname')
  .messages({
    'object.missing': 'Nama lengkap (name/fullname) wajib diisi',
  })
  .options({ abortEarly: false });

export const UpdateUserPayloadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Nama lengkap tidak boleh kosong',
    'string.max': 'Nama lengkap maksimal 100 karakter',
  }),
  fullname: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Nama lengkap tidak boleh kosong',
    'string.max': 'Nama lengkap maksimal 100 karakter',
  }),
  password: Joi.string().min(6).max(100).optional().messages({
    'string.min': 'Password minimal 6 karakter',
    'string.max': 'Password maksimal 100 karakter',
  }),
  role: Joi.string()
    .valid('owner', 'employee', 'Pemilik', 'Karyawan', 'admin', 'operator')
    .optional()
    .messages({
      'any.only': 'Role harus bernilai employee/Karyawan atau owner/Pemilik',
    }),
  is_active: Joi.boolean().optional().messages({
    'boolean.base': 'is_active harus berupa boolean',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Minimal satu field harus diisi untuk pembaruan akun',
  })
  .options({ abortEarly: false });

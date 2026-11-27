import jwt from 'jsonwebtoken';
import config from '../core/config.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';

/**
 * Mengelola pembuatan dan verifikasi access token JWT menggunakan jsonwebtoken (jose-compat).
 * Menggantikan @hapi/jwt agar kompatibel dengan Express + Vercel Serverless.
 */
const TokenManager = {
  /**
   * Menghasilkan JWT access token dengan masa berlaku sesuai JWT_EXPIRE_MINUTES.
   *
   * @param {{ id: number, username: string, role: string, full_name?: string }} payload
   * @returns {string} Signed JWT access token.
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expireMinutes * 60, // detik
    });
  },

  /**
   * Mendekode dan memverifikasi signature serta masa berlaku access token.
   *
   * @param {string} accessToken - Token JWT mentah (tanpa prefix "Bearer ").
   * @returns {Record<string, unknown>} Payload token yang telah terverifikasi.
   */
  verifyAccessToken(accessToken) {
    try {
      return jwt.verify(accessToken, config.jwt.secret);
    } catch {
      throw new AuthenticationError(
        'Access token tidak valid atau sudah kedaluwarsa',
        'INVALID_TOKEN',
      );
    }
  },
};

export default TokenManager;

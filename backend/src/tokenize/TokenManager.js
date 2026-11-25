import Jwt from '@hapi/jwt';
import config from '../core/config.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';

/**
 * Mengelola pembuatan dan verifikasi access token JWT menggunakan @hapi/jwt.
 */
const TokenManager = {
  /**
   * Menghasilkan JWT access token dengan masa berlaku sesuai JWT_EXPIRE_MINUTES.
   *
   * @param {{ id: number, username: string, role: string }} payload - Klaim identitas user.
   * @returns {string} Signed JWT access token.
   */
  generateAccessToken(payload) {
    return Jwt.token.generate(payload, config.jwt.secret, {
      ttlSec: config.jwt.expireMinutes * 60,
    });
  },

  /**
   * Mendekode dan memverifikasi signature serta masa berlaku access token.
   *
   * @param {string} accessToken - Token JWT mentah.
   * @returns {Record<string, unknown>} Payload token yang telah terverifikasi.
   */
  verifyAccessToken(accessToken) {
    try {
      const artifacts = Jwt.token.decode(accessToken);
      Jwt.token.verify(artifacts, config.jwt.secret, {
        aud: false,
        iss: false,
        sub: false,
        exp: true,
        maxAgeSec: config.jwt.expireMinutes * 60,
      });

      return artifacts.decoded.payload;
    } catch {
      throw new AuthenticationError(
        'Access token tidak valid atau sudah kedaluwarsa',
        'INVALID_TOKEN',
      );
    }
  },
};

export default TokenManager;

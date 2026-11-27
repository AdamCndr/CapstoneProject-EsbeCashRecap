/**
 * Handler endpoint autentikasi (login, profil token saat ini, dan pengecekan akses owner).
 * Versi Express — menggantikan Hapi handler.
 */
class AuthHandler {
  /**
   * @param {{ service: import('../../services/AuthService.js').default, tokenManager: import('../../tokenize/TokenManager.js').default, validator: import('../../validator/auth/index.js').default }} deps
   */
  constructor({ service, tokenManager, validator }) {
    this._service = service;
    this._tokenManager = tokenManager;
    this._validator = validator;

    this.postLoginHandler = this.postLoginHandler.bind(this);
    this.getMeHandler = this.getMeHandler.bind(this);
    this.getOwnerOnlyHandler = this.getOwnerOnlyHandler.bind(this);
  }

  /**
   * POST /auth/login
   * Memvalidasi payload, memverifikasi kredensial bcrypt, dan mengembalikan JWT + profil ringkas user.
   */
  async postLoginHandler(req, res, next) {
    try {
      const { username, password } = this._validator.validateLoginPayload(req.body);
      const user = await this._service.verifyUserCredential(username, password);
      const accessToken = this._tokenManager.generateAccessToken(user);

      return res.status(200).json({
        status: 'success',
        message: 'Login berhasil',
        data: {
          accessToken,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name || null,
            role: user.role,
          },
        },
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /auth/me
   * Mengembalikan data user terautentikasi dari payload JWT (di-set oleh middleware authenticate).
   */
  async getMeHandler(req, res, next) {
    try {
      const { id, username, full_name, role } = req.user;

      return res.status(200).json({
        status: 'success',
        data: {
          user: {
            id,
            username,
            full_name: full_name || null,
            role,
          },
        },
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /auth/owner-only
   * Endpoint verifikasi otorisasi khusus role owner.
   */
  async getOwnerOnlyHandler(req, res, next) {
    try {
      const { id, username, role } = req.user;

      return res.status(200).json({
        status: 'success',
        message: 'Akses owner terverifikasi',
        data: {
          user: { id, username, role },
        },
      });
    } catch (err) {
      return next(err);
    }
  }
}

export default AuthHandler;

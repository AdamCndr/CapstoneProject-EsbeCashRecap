/**
 * Handler endpoint autentikasi (login, profil token saat ini, dan pengecekan akses owner).
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
  async postLoginHandler(request, h) {
    const { username, password } = this._validator.validateLoginPayload(request.payload);
    const user = await this._service.verifyUserCredential(username, password);
    const accessToken = this._tokenManager.generateAccessToken(user);

    return h
      .response({
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
      })
      .code(200);
  }

  /**
   * GET /auth/me
   * Mengembalikan data user terautentikasi dari payload JWT.
   */
  async getMeHandler(request, h) {
    const { id, username, role } = request.auth.credentials;

    return h
      .response({
        status: 'success',
        data: {
          user: {
            id,
            username,
            role,
          },
        },
      })
      .code(200);
  }

  /**
   * GET /auth/owner-only
   * Endpoint verifikasi otorisasi khusus role owner.
   */
  async getOwnerOnlyHandler(request, h) {
    const { id, username, role } = request.auth.credentials;

    return h
      .response({
        status: 'success',
        message: 'Akses owner terverifikasi',
        data: {
          user: {
            id,
            username,
            role,
          },
        },
      })
      .code(200);
  }
}

export default AuthHandler;

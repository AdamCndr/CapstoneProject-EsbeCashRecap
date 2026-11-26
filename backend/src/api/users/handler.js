/**
 * Handler endpoint manajemen pengguna (/users/*) khusus role owner.
 */
class UsersHandler {
  /**
   * @param {{
   *   service: import('../../services/UsersService.js').default,
   *   validator: import('../../validator/users/index.js').default,
   * }} deps
   */
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getUsersHandler = this.getUsersHandler.bind(this);
    this.postUserHandler = this.postUserHandler.bind(this);
    this.putUserHandler = this.putUserHandler.bind(this);
    this.deleteUserHandler = this.deleteUserHandler.bind(this);
  }

  async getUsersHandler(request, h) {
    const users = await this._service.getAllUsers();
    return h.response({ status: 'success', data: users }).code(200);
  }

  async postUserHandler(request, h) {
    const payload = this._validator.validateCreateUserPayload(request.payload);
    const user = await this._service.createUser(payload);

    return h
      .response({
        status: 'success',
        message: 'Akun berhasil didaftarkan',
        data: user,
      })
      .code(201);
  }

  async putUserHandler(request, h) {
    const { id } = request.params;
    const payload = this._validator.validateUpdateUserPayload(request.payload);
    const user = await this._service.updateUser(Number(id), payload);

    return h
      .response({
        status: 'success',
        message: 'Akun berhasil diperbarui',
        data: user,
      })
      .code(200);
  }

  async deleteUserHandler(request, h) {
    const { id } = request.params;
    await this._service.deleteUser(Number(id), request.auth.credentials);

    return h
      .response({
        status: 'success',
        message: 'Akun berhasil dihapus',
      })
      .code(200);
  }
}

export default UsersHandler;

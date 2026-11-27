/**
 * Handler endpoint manajemen pengguna (/users/*) khusus role owner.
 * Versi Express.
 */
class UsersHandler {
  constructor({ service, validator }) {
    this._service = service;
    this._validator = validator;

    this.getUsersHandler = this.getUsersHandler.bind(this);
    this.postUserHandler = this.postUserHandler.bind(this);
    this.putUserHandler = this.putUserHandler.bind(this);
    this.deleteUserHandler = this.deleteUserHandler.bind(this);
  }

  async getUsersHandler(req, res, next) {
    try {
      const users = await this._service.getAllUsers();
      return res.status(200).json({ status: 'success', data: users });
    } catch (err) {
      return next(err);
    }
  }

  async postUserHandler(req, res, next) {
    try {
      const payload = this._validator.validateCreateUserPayload(req.body);
      const user = await this._service.createUser(payload);

      return res.status(201).json({
        status: 'success',
        message: 'Akun berhasil didaftarkan',
        data: user,
      });
    } catch (err) {
      return next(err);
    }
  }

  async putUserHandler(req, res, next) {
    try {
      const { id } = req.params;
      const payload = this._validator.validateUpdateUserPayload(req.body);
      const user = await this._service.updateUser(Number(id), payload);

      return res.status(200).json({
        status: 'success',
        message: 'Akun berhasil diperbarui',
        data: user,
      });
    } catch (err) {
      return next(err);
    }
  }

  async deleteUserHandler(req, res, next) {
    try {
      const { id } = req.params;
      await this._service.deleteUser(Number(id), req.user);

      return res.status(200).json({
        status: 'success',
        message: 'Akun berhasil dihapus',
      });
    } catch (err) {
      return next(err);
    }
  }
}

export default UsersHandler;

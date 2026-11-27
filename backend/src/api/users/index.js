import { Router } from 'express';
import UsersHandler from './handler.js';
import { authenticate } from '../../core/authenticate.js';
import { requireRole } from '../../core/authorize.js';
import UsersService from '../../services/UsersService.js';
import UsersValidator from '../../validator/users/index.js';

/**
 * Express Router untuk modul manajemen pengguna (/users/*).
 */
export function createUsersRouter({
  service = new UsersService(),
  validator = UsersValidator,
} = {}) {
  const router = Router();
  const handler = new UsersHandler({ service, validator });

  // Semua endpoint /users/* hanya untuk owner
  router.get('/', authenticate, requireRole('owner'), handler.getUsersHandler);
  router.post('/', authenticate, requireRole('owner'), handler.postUserHandler);
  router.put('/:id', authenticate, requireRole('owner'), handler.putUserHandler);
  router.patch('/:id', authenticate, requireRole('owner'), handler.putUserHandler);
  router.delete('/:id', authenticate, requireRole('owner'), handler.deleteUserHandler);

  return router;
}

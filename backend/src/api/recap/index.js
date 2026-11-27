import { Router } from 'express';
import RecapHandler from './handler.js';
import { authenticate } from '../../core/authenticate.js';
import { requireRole } from '../../core/authorize.js';
import RecapService from '../../services/RecapService.js';
import RecapValidator from '../../validator/recap/index.js';

/**
 * Express Router untuk modul rekapitulasi (/recap).
 */
export function createRecapRouter({
  service = new RecapService(),
  validator = RecapValidator,
} = {}) {
  const router = Router();
  const handler = new RecapHandler({ service, validator });

  // GET /recap — butuh JWT + role owner
  router.get('/', authenticate, requireRole('owner'), handler.getRecapHandler);

  return router;
}

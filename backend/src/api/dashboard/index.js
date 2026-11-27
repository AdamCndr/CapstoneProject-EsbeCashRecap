import { Router } from 'express';
import DashboardHandler from './handler.js';
import { authenticate } from '../../core/authenticate.js';
import { requireRole } from '../../core/authorize.js';
import DashboardService from '../../services/DashboardService.js';
import RecapValidator from '../../validator/recap/index.js';

/**
 * Express Router untuk modul dashboard (/dashboard/*).
 */
export function createDashboardRouter({
  service = new DashboardService(),
  validator = RecapValidator,
} = {}) {
  const router = Router();
  const handler = new DashboardHandler({ service, validator });

  // GET /dashboard/summary — butuh JWT + role owner
  router.get('/summary', authenticate, requireRole('owner'), handler.getDashboardSummaryHandler);

  return router;
}

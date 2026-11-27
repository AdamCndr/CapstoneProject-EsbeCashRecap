import { Router } from 'express';
import AuthHandler from './handler.js';
import { authenticate } from '../../core/authenticate.js';
import { requireRole } from '../../core/authorize.js';
import AuthService from '../../services/AuthService.js';
import TokenManager from '../../tokenize/TokenManager.js';
import AuthValidator from '../../validator/auth/index.js';
import { createLoginRateLimiter } from '../../core/rateLimiter.js';
import config from '../../core/config.js';

/**
 * Express Router untuk modul autentikasi (/auth/*).
 * Semua dependensi di-inject agar tetap mudah diuji.
 */
export function createAuthRouter({
  service = new AuthService(),
  tokenManager = TokenManager,
  validator = AuthValidator,
  loginRateLimiter = createLoginRateLimiter({
    windowMs: config.rateLimit.loginWindowMs,
    maxAttempts: config.rateLimit.loginMaxAttempts,
  }),
} = {}) {
  const router = Router();
  const handler = new AuthHandler({ service, tokenManager, validator });

  // POST /auth/login — rate-limited, tidak butuh auth
  router.post('/login', loginRateLimiter, handler.postLoginHandler);

  // GET /auth/me — butuh JWT
  router.get('/me', authenticate, handler.getMeHandler);

  // GET /auth/owner-only — butuh JWT + role owner
  router.get('/owner-only', authenticate, requireRole('owner'), handler.getOwnerOnlyHandler);

  return router;
}

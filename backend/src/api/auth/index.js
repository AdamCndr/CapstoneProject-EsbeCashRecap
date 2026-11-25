import AuthHandler from './handler.js';
import routes from './routes.js';

/**
 * Plugin Hapi untuk modul autentikasi (/auth/*).
 */
const authPlugin = {
  name: 'auth',
  version: '1.0.0',
  register: async (server, { service, tokenManager, validator, loginRateLimiter }) => {
    const authHandler = new AuthHandler({
      service,
      tokenManager,
      validator,
    });

    server.route(routes(authHandler, loginRateLimiter));
  },
};

export default authPlugin;

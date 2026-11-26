import DashboardHandler from './handler.js';
import routes from './routes.js';

/**
 * Plugin Hapi untuk modul dashboard pemilik (/dashboard/*).
 */
const dashboardPlugin = {
  name: 'dashboard',
  version: '1.0.0',
  register: async (server, { service, validator }) => {
    const dashboardHandler = new DashboardHandler({ service, validator });
    server.route(routes(dashboardHandler));
  },
};

export default dashboardPlugin;

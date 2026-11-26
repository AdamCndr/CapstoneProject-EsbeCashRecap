import RecapHandler from './handler.js';
import routes from './routes.js';

/**
 * Plugin Hapi untuk modul rekapitulasi (/recap).
 */
const recapPlugin = {
  name: 'recap',
  version: '1.0.0',
  register: async (server, { service, validator }) => {
    const recapHandler = new RecapHandler({ service, validator });
    server.route(routes(recapHandler));
  },
};

export default recapPlugin;

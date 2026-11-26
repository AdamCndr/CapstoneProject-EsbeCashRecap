import TransactionsHandler from './handler.js';
import routes from './routes.js';

/**
 * Plugin Hapi untuk modul transaksi (/transactions/*).
 */
const transactionsPlugin = {
  name: 'transactions',
  version: '2.0.0',
  register: async (server, { service, validator }) => {
    const transactionsHandler = new TransactionsHandler({ service, validator });
    server.route(routes(transactionsHandler));
  },
};

export default transactionsPlugin;

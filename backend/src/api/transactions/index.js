import TransactionsHandler from './handler.js';
import routes from './routes.js';

/**
 * Plugin Hapi untuk modul transaksi (/transactions/*).
 */
const transactionsPlugin = {
  name: 'transactions',
  version: '1.0.0',
  register: async (server, { validator }) => {
    const transactionsHandler = new TransactionsHandler({ validator });
    server.route(routes(transactionsHandler));
  },
};

export default transactionsPlugin;

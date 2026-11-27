/**
 * api/index.js — Entrypoint Vercel Serverless Function untuk backend Esbe.
 *
 * Vercel membaca file ini sebagai Serverless Function karena letaknya
 * di folder `api/` di root backend (atau di-route via vercel.json).
 * Express app di-import dari src/server.js dan di-export sebagai default
 * sehingga Vercel bisa memanggil setiap request melaluinya.
 */
import { createApp } from '../src/server.js';

const app = createApp();

export default app;

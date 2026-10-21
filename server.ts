import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import productsRouter from './server/routes/products.js';
import categoriesRouter from './server/routes/categories.js';
import ordersRouter from './server/routes/orders.js';
import settingsRouter from './server/routes/settings.js';
import adminRouter from './server/routes/admin.js';
import paymentRouter from './server/routes/payment.js';
import { getDatabaseRepository } from './server/db/repository.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  // Body parser with 10mb limit for image uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure uploads folder exists
  const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/api/uploads', express.static(uploadsDir));

  // Initialize DB repository
  const repo = await getDatabaseRepository();
  await repo.init();

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'Chandu Chicken Center',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Prevent caching on all API endpoints so updates in Admin appear immediately
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // API Routes
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/payment', paymentRouter);

  // Vite Integration in Development
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('🚀 Mounted Vite dev middlewares in Express on port', PORT);
  } else {
    // Production: serve static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('📦 Serving production client build from dist directory on port', PORT);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍗 Chandu Chicken Center server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

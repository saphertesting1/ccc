import { Router, Request, Response } from 'express';
import { getDatabaseRepository } from '../db/repository.js';

const router = Router();

// GET /api/products
// By default returns only available/active products for customer website and mobile app.
// If includeUnavailable=true is passed, returns all products (used by admin).
router.get('/', async (req: Request, res: Response) => {
  try {
    // Explicitly prevent browser/CDN caching of product catalog
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const repo = await getDatabaseRepository();
    const categoryId = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const includeUnavailable = req.query.includeUnavailable === 'true';

    let products = await repo.getProducts(categoryId, search);

    // Filter out deactivated/unavailable products for public customer views
    if (!includeUnavailable) {
      products = products.filter(p => p.isAvailable !== false);
    }

    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const repo = await getDatabaseRepository();
    const product = await repo.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

export default router;

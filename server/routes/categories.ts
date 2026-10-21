import { Router, Request, Response } from 'express';
import { getDatabaseRepository } from '../db/repository.js';

const router = Router();

// GET /api/categories
router.get('/', async (_req: Request, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const categories = await repo.getCategories();
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

export default router;

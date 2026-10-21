import { Router, Request, Response } from 'express';
import { getDatabaseRepository } from '../db/repository.js';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const repo = await getDatabaseRepository();
    const settings = await repo.getShopSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching shop settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

export default router;

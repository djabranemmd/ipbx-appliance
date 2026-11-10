import { Router } from 'express';
import { query } from '../db';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRole('admin'));

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().trim().max(60).optional(),
});

auditRouter.get('/', async (req, res) => {
  const { limit, offset, action } = listSchema.parse(req.query);

  const filter = action ? 'WHERE action = $1' : '';
  const filterParams = action ? [action] : [];

  const total = await query<{ count: string }>(`SELECT count(*) FROM audit_log ${filter}`, filterParams);
  const items = await query(
    `SELECT id, admin_id AS "adminId", username, action, target, details,
            host(ip_address) AS ip, created_at AS "createdAt"
     FROM audit_log ${filter}
     ORDER BY id DESC
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, limit, offset],
  );

  res.json({ total: Number(total.rows[0].count), items: items.rows });
});
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { query } from '../db';
import { HttpError } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { idParamSchema } from '../validation';

export const rangesRouter = Router();

rangesRouter.use(requireAuth);

const RANGE_SELECT = `
  SELECT r.id, r.name, r.range_start AS "rangeStart", r.range_end AS "rangeEnd",
         (SELECT count(*) FROM extensions e
          WHERE e.number::bigint BETWEEN r.range_start AND r.range_end)::int AS "extensionCount"
  FROM dial_ranges r`;

// the dialplan routes numbers of 3 to 6 digits, so ranges stay inside that
const boundSchema = z.number().int().min(100).max(999999);

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    rangeStart: boundSchema,
    rangeEnd: boundSchema,
  })
  .refine((body) => body.rangeEnd >= body.rangeStart, 'The end of the range must not be below its start');

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    rangeStart: boundSchema,
    rangeEnd: boundSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

rangesRouter.get('/', async (_req, res) => {
  const result = await query(`${RANGE_SELECT} ORDER BY r.range_start`);
  res.json({ items: result.rows });
});

rangesRouter.post('/', requireRole('admin'), async (req, res) => {
  const body = createSchema.parse(req.body);

  const inserted = await query<{ id: number }>(
    'INSERT INTO dial_ranges (name, range_start, range_end) VALUES ($1, $2, $3) RETURNING id',
    [body.name, body.rangeStart, body.rangeEnd],
  );

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'range_create',
    target: body.name,
    details: { rangeStart: body.rangeStart, rangeEnd: body.rangeEnd },
    ip: req.ip,
  });

  const created = await query(`${RANGE_SELECT} WHERE r.id = $1`, [inserted.rows[0].id]);
  res.status(201).json({ range: created.rows[0] });
});

rangesRouter.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const body = updateSchema.parse(req.body);

  const current = await query<{ name: string; range_start: number; range_end: number }>(
    'SELECT name, range_start, range_end FROM dial_ranges WHERE id = $1',
    [id],
  );
  if (!current.rows[0]) {
    throw new HttpError(404, 'Range not found');
  }

  const name = body.name ?? current.rows[0].name;
  const start = body.rangeStart ?? current.rows[0].range_start;
  const end = body.rangeEnd ?? current.rows[0].range_end;
  if (end < start) {
    throw new HttpError(400, 'The end of the range must not be below its start');
  }

  // shrinking a range must not leave an existing extension outside of any range
  const orphans = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM extensions
     WHERE number::bigint BETWEEN $1 AND $2 AND NOT (number::bigint BETWEEN $3 AND $4)`,
    [current.rows[0].range_start, current.rows[0].range_end, start, end],
  );
  if (orphans.rows[0].count > 0) {
    throw new HttpError(409, `${orphans.rows[0].count} extension(s) would fall outside the range`);
  }

  await query('UPDATE dial_ranges SET name = $2, range_start = $3, range_end = $4 WHERE id = $1', [
    id,
    name,
    start,
    end,
  ]);

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'range_update',
    target: name,
    details: body,
    ip: req.ip,
  });

  const updated = await query(`${RANGE_SELECT} WHERE r.id = $1`, [id]);
  res.json({ range: updated.rows[0] });
});

rangesRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = idParamSchema.parse(req.params.id);

  const found = await query<{ name: string; extensionCount: number }>(`${RANGE_SELECT} WHERE r.id = $1`, [id]);
  const range = found.rows[0];
  if (!range) {
    throw new HttpError(404, 'Range not found');
  }
  if (range.extensionCount > 0) {
    throw new HttpError(409, `${range.extensionCount} extension(s) still use this range`);
  }

  await query('DELETE FROM dial_ranges WHERE id = $1', [id]);
  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'range_delete',
    target: range.name,
    ip: req.ip,
  });

  res.status(204).end();
});
import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { query } from '../db';
import { HttpError } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { idParamSchema } from '../validation';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const canWrite = requireRole('admin', 'operator');

const USER_SELECT = `
  SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email,
         u.created_at AS "createdAt", e.id AS "extensionId", e.number AS "extensionNumber"
  FROM users u
  LEFT JOIN extensions e ON e.user_id = u.id`;

const nameSchema = z.string().trim().min(1).max(60);
const emailSchema = z.string().trim().toLowerCase().max(120).pipe(z.email());

const createSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema.nullish(),
});

const updateSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const searchSchema = z.object({ q: z.string().trim().max(60).optional() });

usersRouter.get('/', async (req, res) => {
  const { q } = searchSchema.parse(req.query);

  const result = q
    ? await query(
        `${USER_SELECT}
         WHERE u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1
         ORDER BY u.last_name, u.first_name`,
        [`%${q}%`],
      )
    : await query(`${USER_SELECT} ORDER BY u.last_name, u.first_name`);

  res.json({ items: result.rows });
});

usersRouter.get('/:id', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const result = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  if (!result.rows[0]) {
    throw new HttpError(404, 'User not found');
  }
  res.json({ user: result.rows[0] });
});

usersRouter.post('/', canWrite, async (req, res) => {
  const body = createSchema.parse(req.body);

  const inserted = await query<{ id: number }>(
    'INSERT INTO users (first_name, last_name, email) VALUES ($1, $2, $3) RETURNING id',
    [body.firstName, body.lastName, body.email ?? null],
  );

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'user_create',
    target: `${body.firstName} ${body.lastName}`,
    ip: req.ip,
  });

  const created = await query(`${USER_SELECT} WHERE u.id = $1`, [inserted.rows[0].id]);
  res.status(201).json({ user: created.rows[0] });
});

usersRouter.patch('/:id', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const body = updateSchema.parse(req.body);

  const current = await query<{ first_name: string; last_name: string }>(
    'SELECT first_name, last_name FROM users WHERE id = $1',
    [id],
  );
  if (!current.rows[0]) {
    throw new HttpError(404, 'User not found');
  }

  // email can be cleared on purpose, so "not sent" and "sent as null" are told apart
  await query(
    `UPDATE users
     SET first_name = COALESCE($2, first_name),
         last_name  = COALESCE($3, last_name),
         email      = CASE WHEN $4::boolean THEN $5 ELSE email END
     WHERE id = $1`,
    [id, body.firstName ?? null, body.lastName ?? null, 'email' in body, body.email ?? null],
  );

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'user_update',
    target: `${current.rows[0].first_name} ${current.rows[0].last_name}`,
    details: body,
    ip: req.ip,
  });

  const updated = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  res.json({ user: updated.rows[0] });
});

// the extension of the user is kept, it just becomes unassigned
usersRouter.delete('/:id', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);

  const found = await query<{ firstName: string; lastName: string; extensionNumber: string | null }>(
    `${USER_SELECT} WHERE u.id = $1`,
    [id],
  );
  const user = found.rows[0];
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  await query('DELETE FROM users WHERE id = $1', [id]);
  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'user_delete',
    target: `${user.firstName} ${user.lastName}`,
    details: { extension: user.extensionNumber },
    ip: req.ip,
  });

  res.status(204).end();
});
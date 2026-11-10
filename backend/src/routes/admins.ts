import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { query } from '../db';
import { HttpError } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { AdminRow, findAdminById, toAdmin } from '../models/admin';
import { hashPassword } from '../passwords';
import { fullNameSchema, idParamSchema, passwordSchema, roleSchema, usernameSchema } from '../validation';

export const adminsRouter = Router();

// only administrators manage the accounts of the web interface
adminsRouter.use(requireAuth, requireRole('admin'));

const createSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  role: roleSchema,
});

const updateSchema = z
  .object({
    fullName: fullNameSchema,
    role: roleSchema,
    active: z.boolean(),
    password: passwordSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

adminsRouter.get('/', async (_req, res) => {
  const result = await query<AdminRow>('SELECT * FROM admins ORDER BY id');
  res.json({ items: result.rows.map(toAdmin) });
});

adminsRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body);

  const result = await query<AdminRow>(
    `INSERT INTO admins (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [body.username, await hashPassword(body.password), body.fullName, body.role],
  );

  const created = result.rows[0];
  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'admin_create',
    target: created.username,
    details: { role: created.role },
    ip: req.ip,
  });

  res.status(201).json({ admin: toAdmin(created) });
});

adminsRouter.patch('/:id', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const body = updateSchema.parse(req.body);

  const target = await findAdminById(id);
  if (!target) {
    throw new HttpError(404, 'Administrator not found');
  }

  if (id === req.admin!.id && body.active === false) {
    throw new HttpError(400, 'You cannot disable your own account');
  }

  // the appliance must always keep at least one active administrator
  const losesAdminRights = (body.role !== undefined && body.role !== 'admin') || body.active === false;
  if (target.role === 'admin' && target.active && losesAdminRights) {
    const others = await query<{ count: string }>(
      `SELECT count(*) FROM admins WHERE role = 'admin' AND active AND id <> $1`,
      [id],
    );
    if (Number(others.rows[0].count) === 0) {
      throw new HttpError(400, 'At least one active administrator is required');
    }
  }

  const result = await query<AdminRow>(
    `UPDATE admins
     SET full_name     = COALESCE($2, full_name),
         role          = COALESCE($3, role),
         active        = COALESCE($4, active),
         password_hash = COALESCE($5, password_hash)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.fullName ?? null,
      body.role ?? null,
      body.active ?? null,
      body.password ? await hashPassword(body.password) : null,
    ],
  );

  const { password, ...changes } = body;
  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'admin_update',
    target: target.username,
    details: { ...changes, ...(password ? { passwordChanged: true } : {}) },
    ip: req.ip,
  });

  res.json({ admin: toAdmin(result.rows[0]) });
});
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { query } from '../db';
import { HttpError } from '../errors';
import { requireAuth, signToken } from '../middleware/auth';
import { AdminRow, countAdmins, findAdminById, findAdminByUsername, toAdmin } from '../models/admin';
import { hashPassword, verifyPassword } from '../passwords';
import { fullNameSchema, passwordSchema, usernameSchema } from '../validation';

export const authRouter = Router();

// slows down password guessing: only failed attempts are counted
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again in a few minutes' },
});

const setupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(50),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

// the web interface calls this first to know if it must show the setup page
authRouter.get('/setup-status', async (_req, res) => {
  res.json({ needsSetup: (await countAdmins()) === 0 });
});

// creates the very first administrator, refused once any admin exists
authRouter.post('/setup', authLimiter, async (req, res) => {
  const body = setupSchema.parse(req.body);
  const hash = await hashPassword(body.password);

  const result = await query<AdminRow>(
    `INSERT INTO admins (username, password_hash, full_name, role)
     SELECT $1, $2, $3, 'admin'
     WHERE NOT EXISTS (SELECT 1 FROM admins)
     RETURNING *`,
    [body.username, hash, body.fullName],
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(409, 'The appliance is already configured');
  }

  await writeAudit({ adminId: row.id, username: row.username, action: 'setup', ip: req.ip });
  res.status(201).json({ token: signToken(row.id), admin: toAdmin(row) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);

  const row = await findAdminByUsername(username);
  const passwordOk = await verifyPassword(password, row ? row.password_hash : null);

  if (!row || !passwordOk || !row.active) {
    await writeAudit({ username, action: 'login_failed', ip: req.ip });
    throw new HttpError(401, 'Invalid username or password');
  }

  await query('UPDATE admins SET last_login_at = now() WHERE id = $1', [row.id]);
  await writeAudit({ adminId: row.id, username: row.username, action: 'login', ip: req.ip });

  res.json({ token: signToken(row.id), admin: toAdmin(row) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const admin = req.admin!;
  const body = changePasswordSchema.parse(req.body);

  const row = await findAdminById(admin.id);
  if (!row || !(await verifyPassword(body.currentPassword, row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }

  await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [await hashPassword(body.newPassword), admin.id]);
  await writeAudit({ adminId: admin.id, username: admin.username, action: 'password_change', ip: req.ip });

  res.json({ ok: true });
});
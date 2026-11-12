import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { config } from '../config';
import { query, withTransaction } from '../db';
import { HttpError } from '../errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { findExtension, listExtensions } from '../models/extension';
import { assertNumberInRange } from '../models/range';
import {
  changePassword,
  createEndpoint,
  disableEndpoint,
  enableEndpoint,
  generateSipPassword,
  removeEndpoint,
  updateCallerId,
} from '../pjsip';
import { idParamSchema } from '../validation';

export const extensionsRouter = Router();

extensionsRouter.use(requireAuth);

const canWrite = requireRole('admin', 'operator');

// the dialplan routes numbers of 3 to 6 digits, no leading zero
const numberSchema = z.string().trim().regex(/^[1-9][0-9]{2,5}$/, 'Extension number must have 3 to 6 digits');

// the name ends up inside the sip caller id, so the characters that would break it are refused
const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^"<>\\\r\n]+$/, 'Display name cannot contain quotes, angle brackets or backslashes');

const permissionSchema = z.enum(['internal', 'external']);

const createSchema = z.object({
  number: numberSchema,
  displayName: displayNameSchema.optional(),
  userId: z.number().int().positive().nullish(),
  callPermission: permissionSchema.default('internal'),
  enabled: z.boolean().default(true),
});

const updateSchema = z
  .object({
    displayName: displayNameSchema,
    userId: z.number().int().positive().nullable(),
    callPermission: permissionSchema,
    enabled: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const searchSchema = z.object({ q: z.string().trim().max(60).optional() });

// a user can hold only one extension
async function checkUserAvailable(userId: number, ownExtensionId?: number) {
  const user = await query<{ first_name: string; last_name: string }>(
    'SELECT first_name, last_name FROM users WHERE id = $1',
    [userId],
  );
  if (!user.rows[0]) {
    throw new HttpError(404, 'User not found');
  }

  const taken = await query<{ id: number }>('SELECT id FROM extensions WHERE user_id = $1', [userId]);
  if (taken.rows[0] && taken.rows[0].id !== ownExtensionId) {
    throw new HttpError(409, 'This user already has an extension');
  }

  return `${user.rows[0].first_name} ${user.rows[0].last_name}`.replace(/["<>\\]/g, '').slice(0, 60);
}

async function getOr404(id: number) {
  const extension = await findExtension(id);
  if (!extension) {
    throw new HttpError(404, 'Extension not found');
  }
  return extension;
}

extensionsRouter.get('/', async (req, res) => {
  const { q } = searchSchema.parse(req.query);
  res.json({ items: await listExtensions(q) });
});

extensionsRouter.get('/:id', async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  res.json({ extension: await getOr404(id) });
});

// what is needed to configure a phone; the password is shown only to staff who can edit
extensionsRouter.get('/:id/credentials', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const extension = await getOr404(id);

  const auth = await query<{ password: string }>('SELECT password FROM ps_auths WHERE id = $1', [extension.number]);
  if (!auth.rows[0]) {
    throw new HttpError(404, 'This extension has no sip credentials');
  }

  res.json({
    credentials: {
      username: extension.number,
      password: auth.rows[0].password,
      server: config.pbxHost,
      port: 5060,
      transport: 'UDP',
    },
  });
});

extensionsRouter.post('/', canWrite, async (req, res) => {
  const body = createSchema.parse(req.body);
  await assertNumberInRange(body.number);

  const exists = await query('SELECT 1 FROM extensions WHERE number = $1', [body.number]);
  if (exists.rowCount) {
    throw new HttpError(409, `Extension ${body.number} already exists`);
  }

  // without an explicit name, the name of the user is used
  let displayName = body.displayName;
  if (body.userId) {
    const userName = await checkUserAvailable(body.userId);
    displayName ??= userName;
  }
  displayName ??= `Extension ${body.number}`;

  const password = generateSipPassword();

  const id = await withTransaction(async (db) => {
    const inserted = await db.query<{ id: number }>(
      `INSERT INTO extensions (number, user_id, display_name, enabled, call_permission)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.number, body.userId ?? null, displayName, body.enabled, body.callPermission],
    );
    await createEndpoint(db, body.number, displayName, password, body.enabled);
    return inserted.rows[0].id;
  });

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'extension_create',
    target: body.number,
    details: { userId: body.userId ?? null, callPermission: body.callPermission },
    ip: req.ip,
  });

  // the password is returned now so the phone can be configured right away
  res.status(201).json({ extension: await getOr404(id), sipPassword: password });
});

extensionsRouter.patch('/:id', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const body = updateSchema.parse(req.body);
  const current = await getOr404(id);

  // undefined keeps the current owner, null removes it, a number assigns another user
  let userId = current.user?.id ?? null;
  if (body.userId !== undefined) {
    if (body.userId !== null) {
      await checkUserAvailable(body.userId, id);
    }
    userId = body.userId;
  }

  const displayName = body.displayName ?? current.displayName;
  const enabled = body.enabled ?? current.enabled;
  const callPermission = body.callPermission ?? current.callPermission;

  await withTransaction(async (db) => {
    await db.query(
      `UPDATE extensions
       SET user_id = $2, display_name = $3, enabled = $4, call_permission = $5
       WHERE id = $1`,
      [id, userId, displayName, enabled, callPermission],
    );

    if (current.enabled && !enabled) {
      await disableEndpoint(db, current.number);
    } else if (!current.enabled && enabled) {
      await enableEndpoint(db, current.number, displayName);
    } else if (enabled && displayName !== current.displayName) {
      await updateCallerId(db, current.number, displayName);
    }
  });

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'extension_update',
    target: current.number,
    details: body,
    ip: req.ip,
  });

  res.json({ extension: await getOr404(id) });
});

extensionsRouter.post('/:id/reset-password', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const extension = await getOr404(id);
  const password = generateSipPassword();

  await withTransaction((db) => changePassword(db, extension.number, password));

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'extension_password_reset',
    target: extension.number,
    ip: req.ip,
  });

  res.json({ sipPassword: password });
});

extensionsRouter.delete('/:id', canWrite, async (req, res) => {
  const id = idParamSchema.parse(req.params.id);
  const extension = await getOr404(id);

  await withTransaction(async (db) => {
    await removeEndpoint(db, extension.number);
    await db.query('DELETE FROM extensions WHERE id = $1', [id]);
  });

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'extension_delete',
    target: extension.number,
    ip: req.ip,
  });

  res.status(204).end();
});
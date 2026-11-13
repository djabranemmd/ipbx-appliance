import { Router } from 'express';
import { z } from 'zod';
import { writeAudit } from '../audit';
import { requireAuth, requireRole } from '../middleware/auth';
import { listExtensions } from '../models/extension';
import { getChannels, getLiveEndpoints, getStatus, hangupChannel, reloadAsterisk } from '../pbx';

export const pbxRouter = Router();

pbxRouter.use(requireAuth);

// names like PJSIP/101-00000001 or Local/*43@internal-00000000;2
const hangupSchema = z.object({
  channel: z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z0-9/_.;@*#+:-]+$/, 'Invalid channel name'),
});

const reloadSchema = z.object({ target: z.enum(['dialplan', 'pjsip']) });

pbxRouter.get('/status', async (_req, res) => {
  res.json({ status: await getStatus() });
});

// what the dashboard shows: every extension with its live state and the counters
pbxRouter.get('/summary', async (_req, res) => {
  const [extensions, live, { calls }] = await Promise.all([listExtensions(), getLiveEndpoints(), getChannels()]);

  const items = extensions.map((extension) => ({
    id: extension.id,
    number: extension.number,
    displayName: extension.displayName,
    enabled: extension.enabled,
    user: extension.user,
    live: live.get(extension.number) ?? { registered: false, state: 'unavailable', contacts: [], activeChannels: 0 },
  }));

  res.json({
    counters: {
      extensions: items.length,
      registered: items.filter((item) => item.live.registered).length,
      busy: items.filter((item) => item.live.state === 'busy').length,
      ringing: items.filter((item) => item.live.state === 'ringing').length,
      activeCalls: calls.length,
    },
    extensions: items,
  });
});

pbxRouter.get('/channels', async (_req, res) => {
  res.json(await getChannels());
});

pbxRouter.post('/hangup', requireRole('admin', 'operator'), async (req, res) => {
  const { channel } = hangupSchema.parse(req.body);
  await hangupChannel(channel);

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'call_hangup',
    target: channel,
    ip: req.ip,
  });

  res.json({ ok: true });
});

pbxRouter.post('/reload', requireRole('admin'), async (req, res) => {
  const { target } = reloadSchema.parse(req.body);
  const output = await reloadAsterisk(target);

  await writeAudit({
    adminId: req.admin!.id,
    username: req.admin!.username,
    action: 'asterisk_reload',
    target,
    ip: req.ip,
  });

  res.json({ ok: true, output });
});
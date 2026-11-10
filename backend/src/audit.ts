import { query } from './db';

interface AuditEntry {
  adminId?: number | null;
  username?: string | null;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await query(
    `INSERT INTO audit_log (admin_id, username, action, target, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.adminId ?? null,
      entry.username ?? null,
      entry.action,
      entry.target ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ip ?? null,
    ],
  );
}
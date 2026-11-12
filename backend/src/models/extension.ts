import { query } from '../db';

export type CallPermission = 'internal' | 'external';

interface ExtensionRow {
  id: number;
  number: string;
  display_name: string;
  enabled: boolean;
  call_permission: CallPermission;
  user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  contact_uri: string | null;
  user_agent: string | null;
  expiration_time: string | null;
}

// registration state comes from ps_contacts, the table asterisk fills when a
// phone registers; an expired contact does not count
const EXTENSION_SELECT = `
  SELECT e.id, e.number, e.display_name, e.enabled, e.call_permission, e.user_id,
         u.first_name, u.last_name,
         c.uri AS contact_uri, c.user_agent, c.expiration_time
  FROM extensions e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN LATERAL (
    SELECT uri, user_agent, expiration_time
    FROM ps_contacts
    WHERE endpoint = e.number AND expiration_time > extract(epoch FROM now())
    ORDER BY expiration_time DESC
    LIMIT 1
  ) c ON true`;

function toExtension(row: ExtensionRow) {
  return {
    id: row.id,
    number: row.number,
    displayName: row.display_name,
    enabled: row.enabled,
    callPermission: row.call_permission,
    user: row.user_id ? { id: row.user_id, firstName: row.first_name, lastName: row.last_name } : null,
    registration: {
      registered: row.contact_uri !== null,
      contactUri: row.contact_uri,
      userAgent: row.user_agent,
      expiresAt: row.expiration_time ? new Date(Number(row.expiration_time) * 1000) : null,
    },
  };
}

export async function listExtensions(search?: string) {
  const result = search
    ? await query<ExtensionRow>(
        `${EXTENSION_SELECT}
         WHERE e.number LIKE $1 OR e.display_name ILIKE $2
         ORDER BY length(e.number), e.number`,
        [`${search}%`, `%${search}%`],
      )
    : await query<ExtensionRow>(`${EXTENSION_SELECT} ORDER BY length(e.number), e.number`);
  return result.rows.map(toExtension);
}

export async function findExtension(id: number) {
  const result = await query<ExtensionRow>(`${EXTENSION_SELECT} WHERE e.id = $1`, [id]);
  return result.rows[0] ? toExtension(result.rows[0]) : null;
}
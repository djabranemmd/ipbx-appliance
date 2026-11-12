import { randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';

// asterisk reads these tables live (realtime), so what is written here is
// active on the pbx at once, no reload needed

export function generateSipPassword(): string {
  return randomBytes(12).toString('hex');
}

function callerId(displayName: string, number: string): string {
  return `"${displayName}" <${number}>`;
}

async function insertEndpoint(db: PoolClient, number: string, displayName: string) {
  await db.query(
    `INSERT INTO ps_endpoints (id, transport, aors, auth, context, disallow, allow, direct_media,
                               dtmf_mode, force_rport, rewrite_contact, rtp_symmetric, ice_support,
                               callerid, identify_by)
     VALUES ($1, 'transport-udp', $1, $1, 'internal', 'all', 'ulaw,alaw,gsm', 'no',
             'rfc4733', 'yes', 'yes', 'yes', 'no',
             $2, 'username,auth_username')
     ON CONFLICT (id) DO NOTHING`,
    [number, callerId(displayName, number)],
  );
}

export async function createEndpoint(
  db: PoolClient,
  number: string,
  displayName: string,
  password: string,
  enabled: boolean,
) {
  await db.query(
    `INSERT INTO ps_aors (id, max_contacts, remove_existing, qualify_frequency,
                          default_expiration, minimum_expiration, maximum_expiration)
     VALUES ($1, 1, 'yes', 30, 3600, 60, 7200)`,
    [number],
  );
  await db.query(
    `INSERT INTO ps_auths (id, auth_type, username, password)
     VALUES ($1, 'userpass', $1, $2)`,
    [number, password],
  );
  if (enabled) {
    await insertEndpoint(db, number, displayName);
  }
}

// without its endpoint row asterisk refuses both registrations and calls
export async function disableEndpoint(db: PoolClient, number: string) {
  await db.query('DELETE FROM ps_endpoints WHERE id = $1', [number]);
  await db.query('DELETE FROM ps_contacts WHERE endpoint = $1', [number]);
}

export async function enableEndpoint(db: PoolClient, number: string, displayName: string) {
  await insertEndpoint(db, number, displayName);
}

export async function updateCallerId(db: PoolClient, number: string, displayName: string) {
  await db.query('UPDATE ps_endpoints SET callerid = $2 WHERE id = $1', [number, callerId(displayName, number)]);
}

// the registered phone is dropped so the old password stops working right away
export async function changePassword(db: PoolClient, number: string, password: string) {
  await db.query('UPDATE ps_auths SET password = $2 WHERE id = $1', [number, password]);
  await db.query('DELETE FROM ps_contacts WHERE endpoint = $1', [number]);
}

export async function removeEndpoint(db: PoolClient, number: string) {
  await db.query('DELETE FROM ps_endpoints WHERE id = $1', [number]);
  await db.query('DELETE FROM ps_auths WHERE id = $1', [number]);
  await db.query('DELETE FROM ps_aors WHERE id = $1', [number]);
  await db.query('DELETE FROM ps_contacts WHERE endpoint = $1', [number]);
}
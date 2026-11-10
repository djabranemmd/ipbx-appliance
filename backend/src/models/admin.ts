import { query } from '../db';

export type Role = 'admin' | 'operator' | 'viewer';

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: Role;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

// what the api returns: never includes the password hash
export interface Admin {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export async function findAdminById(id: number): Promise<AdminRow | null> {
  const result = await query<AdminRow>('SELECT * FROM admins WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function findAdminByUsername(username: string): Promise<AdminRow | null> {
  const result = await query<AdminRow>('SELECT * FROM admins WHERE username = $1', [username]);
  return result.rows[0] ?? null;
}

export async function countAdmins(): Promise<number> {
  const result = await query<{ count: string }>('SELECT count(*) FROM admins');
  return Number(result.rows[0].count);
}
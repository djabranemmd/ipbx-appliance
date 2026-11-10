import { Pool, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({ ...config.db, max: 10 });

pool.on('error', (err) => {
  console.error('postgres pool error:', err.message);
});

export function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}
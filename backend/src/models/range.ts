import { query } from '../db';
import { HttpError } from '../errors';

// an extension number must belong to one of the ranges of the numbering plan
export async function assertNumberInRange(number: string): Promise<void> {
  const result = await query(
    'SELECT 1 FROM dial_ranges WHERE $1::bigint BETWEEN range_start AND range_end',
    [number],
  );
  if (result.rowCount === 0) {
    throw new HttpError(400, `Number ${number} is not inside any numbering range, create the range first`);
  }
}
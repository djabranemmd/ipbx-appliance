import bcrypt from 'bcryptjs';

const COST = 12;

// compared against when the username does not exist, so a failed login
// takes about the same time whether the account exists or not
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && ok;
}
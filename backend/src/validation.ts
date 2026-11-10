import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Username must be 3 to 32 characters: letters, digits, dot, dash or underscore');

// bcrypt only looks at the first 72 bytes, so longer passwords are refused
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const fullNameSchema = z.string().trim().min(1, 'Full name is required').max(100);

export const roleSchema = z.enum(['admin', 'operator', 'viewer']);

export const idParamSchema = z.coerce.number().int().positive();
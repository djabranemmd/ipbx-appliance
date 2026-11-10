import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../errors';
import { Admin, Role, findAdminById, toAdmin } from '../models/admin';

declare global {
  namespace Express {
    interface Request {
      admin?: Admin;
    }
  }
}

export function signToken(adminId: number): string {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(adminId),
    expiresIn: config.jwtExpiresIn,
  });
}

// the token only carries the admin id: role and active flag are read from the
// database on every request, so a disabled account or a role change applies at once
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required');
  }

  let adminId: number;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
    adminId = typeof payload === 'string' ? NaN : Number(payload.sub);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const row = Number.isInteger(adminId) ? await findAdminById(adminId) : null;
  if (!row || !row.active) {
    throw new HttpError(401, 'Account not found or disabled');
  }

  req.admin = toAdmin(row);
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }
    next();
  };
}
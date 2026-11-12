import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors';

function hasProp<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid data',
      details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  // body that is not valid json
  if (hasProp(err, 'type') && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }

  // unique constraint (duplicate username, extension number...)
  if (hasProp(err, 'code') && err.code === '23505') {
    res.status(409).json({ error: 'This value already exists' });
    return;
  }

  // exclusion constraint: two numbering ranges overlap
  if (hasProp(err, 'code') && err.code === '23P01') {
    res.status(409).json({ error: 'This range overlaps an existing range' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
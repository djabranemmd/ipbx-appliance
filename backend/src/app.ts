import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { adminsRouter } from './routes/admins';
import { auditRouter } from './routes/audit';
import { authRouter } from './routes/auth';
import { extensionsRouter } from './routes/extensions';
import { healthRouter } from './routes/health';
import { rangesRouter } from './routes/ranges';
import { usersRouter } from './routes/users';

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admins', adminsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/users', usersRouter);
app.use('/api/extensions', extensionsRouter);
app.use('/api/ranges', rangesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
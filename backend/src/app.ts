import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { adminsRouter } from './routes/admins';
import { auditRouter } from './routes/audit';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admins', adminsRouter);
app.use('/api/audit', auditRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
import { ami } from './ami';
import { app } from './app';
import { config } from './config';
import { pool } from './db';

const server = app.listen(config.port, () => {
  console.log(`api listening on port ${config.port}`);
});

ami.start();

async function shutdown() {
  server.close();
  ami.stop();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
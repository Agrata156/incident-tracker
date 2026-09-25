const { createApp } = require('./app');
const { createDb } = require('./db');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);

if (!process.env.FEATURE_FLAG_SERVICE_URL) {
  throw new Error('FEATURE_FLAG_SERVICE_URL is not set');
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set in production');
  process.exit(1);
}

const dbPath = process.env.DB_PATH || './data/incidents.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const app = createApp({ db: createDb(dbPath) });

const server = app.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', msg: `Incident Tracker listening on port ${port}`, env: process.env.APP_ENV }));
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
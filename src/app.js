const express = require('express');
const helmet = require('helmet');
const { createDb } = require('./db');
const { createUserService } = require('./services/userService');
const { createIncidentService } = require('./services/incidentService');
const { createMetrics } = require('./metrics');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { authRouter } = require('./routes/auth');
const { incidentsRouter } = require('./routes/incidents');

const pkg = require('../package.json');

function createApp(options = {}) {
  const db = options.db || createDb();
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'dev-only-secret';
  const rateLimitMax = options.rateLimitMax || Number(process.env.AUTH_RATE_LIMIT || 100);

  const userService = createUserService(db);
  const incidentService = createIncidentService(db);
  const metrics = createMetrics(incidentService);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(metrics.middleware);

  app.get('/', (req, res) => {
    res.json({ name: 'Security Incident Tracker API', version: pkg.version, env: process.env.APP_ENV || 'dev' });
  });

  app.get('/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', version: process.env.APP_VERSION || pkg.version, uptime: process.uptime() });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
  });

  app.use('/api/auth', authRouter({ userService, jwtSecret, rateLimitMax }));
  app.use('/api/incidents', requireAuth(jwtSecret), incidentsRouter({ incidentService }));

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
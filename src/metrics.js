const client = require('prom-client');

function createMetrics(incidentService) {
  const register = new client.Registry();
  register.setDefaultLabels({ app: 'incident-tracker', env: process.env.APP_ENV || 'dev' });
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  });

  // Start the failed-login counters at 0 so Prometheus sees the first
  // burst of failed logins as an increase (otherwise the series starts at its peak).
  httpRequests.inc({ method: 'POST', route: '/api/auth/login', status: '401' }, 0);
  httpRequests.inc({ method: 'POST', route: '/api/auth', status: '429' }, 0);

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
    registers: [register],
  });

  const openIncidents = new client.Gauge({
    name: 'incidents_open',
    help: 'Number of unresolved incidents by severity',
    labelNames: ['severity'],
    registers: [],
    collect() {
      const { openBySeverity } = incidentService.stats();
      for (const [severity, count] of Object.entries(openBySeverity)) {
        this.set({ severity }, count);
      }
    },
  });

  register.registerMetric(openIncidents);

  function middleware(req, res, next) {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? `${req.baseUrl}${req.route.path}` : req.baseUrl || 'unmatched';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  }

  return { register, middleware };
}

module.exports = { createMetrics };
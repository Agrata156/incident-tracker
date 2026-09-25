const request = require('supertest');
const { buildApp, registerAndLogin } = require('../helpers');

describe('Incidents API', () => {
  let app;
  let adminToken;
  let analystToken;

  beforeEach(async () => {
    app = buildApp();
    adminToken = await registerAndLogin(app, 'admin1'); // first user = admin
    analystToken = await registerAndLogin(app, 'analyst1');
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  test('rejects requests without a token', async () => {
    expect((await request(app).get('/api/incidents')).status).toBe(401);
  });

  test('rejects requests with an invalid token', async () => {
    const res = await request(app).get('/api/incidents').set(auth('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  test('full create → read → update flow', async () => {
    const created = await request(app)
      .post('/api/incidents')
      .set(auth(analystToken))
      .send({ title: 'Suspicious login from new country', severity: 'High', assignee: 'analyst1' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('Open');

    const fetched = await request(app).get(`/api/incidents/${created.body.id}`).set(auth(analystToken));
    expect(fetched.body.title).toBe('Suspicious login from new country');

    const updated = await request(app)
      .patch(`/api/incidents/${created.body.id}`)
      .set(auth(analystToken))
      .send({ status: 'Investigating' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('Investigating');
  });

  test('validates incident input', async () => {
    const res = await request(app).post('/api/incidents').set(auth(analystToken)).send({ title: 'x' });
    expect(res.status).toBe(400);
    const patch = await request(app).patch('/api/incidents/1').set(auth(analystToken)).send({ severity: 'Nope' });
    expect(patch.status).toBe(400);
  });

  test('returns 404 for unknown incidents and 400 for bad ids', async () => {
    expect((await request(app).get('/api/incidents/999').set(auth(analystToken))).status).toBe(404);
    expect((await request(app).get('/api/incidents/abc').set(auth(analystToken))).status).toBe(400);
    expect((await request(app).patch('/api/incidents/999').set(auth(analystToken)).send({ status: 'Resolved' })).status).toBe(404);
    expect((await request(app).patch('/api/incidents/0').set(auth(analystToken)).send({})).status).toBe(400);
  });

  test('filters the list by severity', async () => {
    await request(app).post('/api/incidents').set(auth(analystToken)).send({ title: 'DDoS attack', severity: 'Critical' });
    await request(app).post('/api/incidents').set(auth(analystToken)).send({ title: 'Spam email', severity: 'Low' });
    const res = await request(app).get('/api/incidents?severity=Critical').set(auth(analystToken));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('DDoS attack');
  });

  test('only admins can delete incidents', async () => {
    const { body } = await request(app).post('/api/incidents').set(auth(analystToken)).send({ title: 'Data leak', severity: 'Critical' });
    expect((await request(app).delete(`/api/incidents/${body.id}`).set(auth(analystToken))).status).toBe(403);
    expect((await request(app).delete(`/api/incidents/${body.id}`).set(auth(adminToken))).status).toBe(204);
    expect((await request(app).delete(`/api/incidents/${body.id}`).set(auth(adminToken))).status).toBe(404);
    expect((await request(app).delete('/api/incidents/xyz').set(auth(adminToken))).status).toBe(400);
  });

  test('stats reports open incidents by severity', async () => {
    await request(app).post('/api/incidents').set(auth(analystToken)).send({ title: 'Ransomware', severity: 'Critical' });
    const res = await request(app).get('/api/incidents/stats').set(auth(analystToken));
    expect(res.body.openBySeverity.Critical).toBe(1);
  });
});

describe('Operational endpoints', () => {
  const app = buildApp();

  test('GET / returns app info', async () => {
    const res = await request(app).get('/');
    expect(res.body.name).toMatch(/Incident Tracker/);
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('incidents_open');
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('sets security headers via helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

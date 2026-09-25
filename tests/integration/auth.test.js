const request = require('supertest');
const { buildApp } = require('../helpers');

describe('Auth API', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  test('registers a user and returns 201', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'agrata', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'agrata', role: 'admin' });
    expect(res.body.password_hash).toBeUndefined();
  });

  test('rejects invalid registration data with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('rejects duplicate usernames with 409', async () => {
    const body = { username: 'agrata', password: 'password123' };
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  test('logs in and returns a JWT', async () => {
    const body = { username: 'agrata', password: 'password123' };
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('rejects a wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({ username: 'agrata', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ username: 'agrata', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  test('rejects malformed login bodies with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });
});

const request = require('supertest');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

function buildApp() {
  return createApp({ db: createDb(':memory:'), jwtSecret: 'test-secret', rateLimitMax: 1000 });
}

async function registerAndLogin(app, username, password = 'password123') {
  await request(app).post('/api/auth/register').send({ username, password });
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.token;
}

module.exports = { buildApp, registerAndLogin };

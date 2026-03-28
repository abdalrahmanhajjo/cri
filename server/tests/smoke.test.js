const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db');

afterAll(async () => {
  await pool.end();
});

describe('Smoke Tests', () => {
  test('GET /health should return 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /ready should return 200 (or 503 if DB is down)', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.statusCode);
  });

  test('GET /api/places should return 200 with place lists', async () => {
    const res = await request(app).get('/api/places');
    expect(res.statusCode).toBe(200);
    expect(
      Array.isArray(res.body?.locations) || Array.isArray(res.body?.popular) || Array.isArray(res.body?.places)
    ).toBe(true);
  });
});

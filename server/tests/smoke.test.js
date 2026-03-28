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

  test('GET /api/places — 200 with lists when schema exists; 5xx + error when tables are missing', async () => {
    const res = await request(app).get('/api/places');
    if (res.statusCode === 200) {
      expect(
        Array.isArray(res.body?.locations) ||
          Array.isArray(res.body?.popular) ||
          Array.isArray(res.body?.places)
      ).toBe(true);
      return;
    }
    // GitHub Actions postgres service has no app schema until migrations/dump are applied
    expect([500, 503]).toContain(res.statusCode);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});

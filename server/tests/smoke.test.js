const request = require('supertest');
const app = require('../src/app');

describe('Smoke Tests', () => {
  test('GET /health should return 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /ready should return 200 (or 503 if DB is down)', async () => {
    const res = await request(app).get('/ready');
    // We don't necessarily need the DB to be up for this test in all environments,
    // but 200 or 503 are the expected responses.
    expect([200, 503]).toContain(res.statusCode);
  });

  test('GET /api/places should return 200', async () => {
    const res = await request(app).get('/api/places');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('places');
  });
});

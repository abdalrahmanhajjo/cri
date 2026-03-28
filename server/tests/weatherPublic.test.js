const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const request = require('supertest');
const app = require('../src/app');

describe('GET /api/public/weather/tripoli', () => {
  test('returns JSON with current and daily when upstream works', async () => {
    const res = await request(app).get('/api/public/weather/tripoli');
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.current).toBeDefined();
      expect(res.body.daily).toBeDefined();
      expect(typeof res.body.current.temperature_2m).toBe('number');
    }
  });
});

describe('GET /api/public/weather/day', () => {
  test('400 on bad dates', async () => {
    const res = await request(app).get('/api/public/weather/day').query({ start_date: 'x', end_date: 'x' });
    expect(res.status).toBe(400);
  });

  test('200 or 502 for valid day', async () => {
    const res = await request(app)
      .get('/api/public/weather/day')
      .query({ start_date: '2026-03-28', end_date: '2026-03-28' });
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.daily?.weather_code).toBeDefined();
    }
  });
});

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const request = require('supertest');
const app = require('../src/app');

jest.setTimeout(15000);

describe('GET /api/places', () => {
  test('rejects invalid limit', async () => {
    const res = await request(app).get('/api/places').query({ limit: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('with limit returns page metadata when DB available', async () => {
    const res = await request(app).get('/api/places').query({ limit: '5', offset: '0' });
    if (res.status === 503 || res.status === 500) {
      expect([503, 500]).toContain(res.status);
      return;
    }
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.popular)).toBe(true);
    expect(res.body.page).toMatchObject({
      limit: 5,
      offset: 0,
      total: expect.any(Number),
      hasMore: expect.any(Boolean),
    });
  });
});

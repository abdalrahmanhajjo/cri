/**
 * Authorization smoke: protected JSON APIs must not succeed without a valid session.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const request = require('supertest');
const app = require('../src/app');

describe('API authorization smoke', () => {
  test('GET /api/user/profile without Authorization returns 401', async () => {
    const res = await request(app).get('/api/user/profile');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/places without Authorization returns 401', async () => {
    const res = await request(app).get('/api/admin/places');
    expect(res.status).toBe(401);
  });
});

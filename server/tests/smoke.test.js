/**
 * Loads env before app (same paths as index.js) so optional DB checks behave predictably.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const request = require('supertest');
const app = require('../src/app');

describe('API smoke', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  test('GET /ready returns 200 or 503', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toMatchObject({ status: 'ready', database: 'connected' });
    } else {
      expect(res.body).toMatchObject({ status: 'error', database: 'disconnected' });
    }
  });
});

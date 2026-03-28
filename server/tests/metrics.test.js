const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });

const request = require('supertest');
const app = require('../src/app');

describe('POST /api/metrics/vitals', () => {
  test('accepts a valid LCP payload (204)', async () => {
    const res = await request(app)
      .post('/api/metrics/vitals')
      .send({
        name: 'LCP',
        value: 1200,
        delta: 1200,
        id: 'v2-1234567890-1',
        rating: 'good',
      });
    expect(res.status).toBe(204);
  });

  test('rejects unknown metric name (400)', async () => {
    const res = await request(app).post('/api/metrics/vitals').send({ name: 'FOO', value: 1 });
    expect(res.status).toBe(400);
  });
});

test('should load pg', () => {
  const { Pool } = require('pg');
  expect(Pool).toBeDefined();
});
test('should load dotenv', () => {
  const dotenv = require('dotenv');
  expect(dotenv).toBeDefined();
});
test('should load app.js dependencies one by one', () => {
  require('express');
  require('cors');
  require('compression');
  require('helmet');
  require('express-rate-limit');
  require('express-async-errors');
});

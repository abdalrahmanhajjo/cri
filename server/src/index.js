const fs = require('fs');
const path = require('path');

// Load environment first
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
const rootEnvPath = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
}

const config = require('./config');
const { logger } = require('./middleware/logging');

if (config.NODE_ENV === 'production') {
  if (!config.DATABASE_URL) {
    logger.error('Fatal: DATABASE_URL is missing in production.');
    process.exit(1);
  }
  if (!config.JWT_SECRET || config.JWT_SECRET === 'fallback-dev-only') {
    logger.error('Fatal: A strong JWT_SECRET is required in production.');
    process.exit(1);
  }
}

const app = require('./app');
const { verifyDatabaseConnection } = require('./db');

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info('server_started', {
    port: config.PORT,
    host: config.HOST,
    env: config.NODE_ENV,
    aiConfig: {
      groq: Boolean(process.env.GROQ_API_KEY),
      n8n: Boolean(process.env.N8N_WEBHOOK_URL)
    }
  });
  
  console.log(`Tripoli Explorer Web API running on http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}`);
  
  void verifyDatabaseConnection();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('port_in_use', { port: config.PORT });
    process.exit(1);
  }
  throw err;
});

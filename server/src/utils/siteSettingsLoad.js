const { query } = require('../db');

const ROW_ID = 'default';

async function loadSiteSettings() {
  try {
    const { rows } = await query('SELECT data FROM site_settings WHERE id = $1', [ROW_ID]);
    const data = rows[0]?.data;
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    if (err.code === '42P01') return {};
    throw err;
  }
}

module.exports = { loadSiteSettings, SITE_SETTINGS_ROW_ID: ROW_ID };

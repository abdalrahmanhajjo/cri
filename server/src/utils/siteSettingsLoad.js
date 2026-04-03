const { getCollection } = require('../mongo');

const ROW_ID = 'default';

async function loadSiteSettings() {
  try {
    const coll = await getCollection('site_settings');
    const doc = await coll.findOne({ id: ROW_ID });
    const data = doc?.data;
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    console.error('[siteSettingsLoad]', err);
    return {};
  }
}

module.exports = { loadSiteSettings, SITE_SETTINGS_ROW_ID: ROW_ID };

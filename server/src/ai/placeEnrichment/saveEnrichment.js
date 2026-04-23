const { getCollection } = require('../../mongo');

/**
 * Saves the AI Place Profile to the database
 * @param {string} placeId
 * @param {Object} aiProfile
 */
async function saveEnrichment(placeId, aiProfile) {
  const placesColl = await getCollection('places');
  const enrichmentData = {
    ai_profile: aiProfile,
    enrichment_status: 'completed',
    enrichment_version: 'v1.0',
    enrichment_updated_at: new Date()
  };

  await placesColl.updateOne(
    { id: placeId },
    { $set: enrichmentData }
  );
}

/**
 * Marks place as failed in enrichment
 * @param {string} placeId
 */
async function markEnrichmentFailed(placeId, errorString) {
  const placesColl = await getCollection('places');
  const enrichmentData = {
    enrichment_status: 'failed',
    enrichment_error: errorString,
    enrichment_updated_at: new Date()
  };

  await placesColl.updateOne(
    { id: placeId },
    { $set: enrichmentData }
  );
}

module.exports = { saveEnrichment, markEnrichmentFailed };

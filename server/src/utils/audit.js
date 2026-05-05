const { getCollection } = require('../mongo');

/**
 * Log a sensitive administrative or security event.
 * @param {string} action - e.g. 'delete_place', 'block_user', 'change_site_settings'
 * @param {Object} actor - { userId, email, ip }
 * @param {Object} details - Additional data about the event
 */
async function logAuditEvent(action, actor, details = {}) {
  try {
    const coll = await getCollection('audit_logs');
    await coll.insertOne({
      action,
      actor: {
        user_id: actor.userId,
        email: actor.email,
        ip: actor.ip || 'unknown'
      },
      details,
      created_at: new Date()
    });
  } catch (err) {
    // We don't want audit logging failure to crash the main request, but we should log it
    console.error('[Audit] Failed to log event:', action, err.message);
  }
}

module.exports = { logAuditEvent };

/**
 * Username for profiles.username — stored as @handle (lowercase), same idea as the mobile app.
 */

const RESERVED = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'root',
  'system',
  'visittripoli',
  'tripoli',
  'official',
  'staff',
  'moderator',
]);

const HANDLE_RE = /^[a-z][a-z0-9_]{2,29}$/;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, handle: string, stored: string } | { ok: false, error: string }}
 */
function validateUsername(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { ok: false, error: 'Username is required' };
  }
  const s = raw.trim().toLowerCase().replace(/^@+/, '');
  if (s.length < 3) {
    return { ok: false, error: 'Username must be at least 3 characters' };
  }
  if (s.length > 30) {
    return { ok: false, error: 'Username must be at most 30 characters' };
  }
  if (!HANDLE_RE.test(s)) {
    return {
      ok: false,
      error:
        'Username must start with a letter and contain only lowercase letters, numbers, and underscores',
    };
  }
  if (RESERVED.has(s)) {
    return { ok: false, error: 'This username is reserved' };
  }
  return { ok: true, handle: s, stored: `@${s}` };
}

module.exports = { validateUsername, RESERVED, HANDLE_RE };

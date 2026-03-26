/**
 * Allow-list PostgreSQL identifiers (table names) used in dynamic SQL fragments.
 * Never interpolate user input as identifiers — only values via $1, $2, …
 */

const SAFE_IDENT_RE = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * @param {string} name
 * @param {Set<string> | string[]} allowed
 * @returns {string} same as `name` if valid
 */
function assertAllowedTableName(name, allowed) {
  if (typeof name !== 'string' || !SAFE_IDENT_RE.test(name)) {
    throw new Error('Invalid SQL identifier');
  }
  const set = allowed instanceof Set ? allowed : new Set(allowed);
  if (!set.has(name)) {
    throw new Error('Disallowed table name');
  }
  return name;
}

module.exports = { assertAllowedTableName, SAFE_IDENT_RE };

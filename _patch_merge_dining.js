const fs = require('fs');
const p = 'server/src/routes/places.js';
let s = fs.readFileSync(p, 'utf8');
const oldDocToPlaceHead = `function docToPlace(doc, baseUrl) {
  let images = Array.isArray(doc.images) ? doc.images : [];
  images = resolveImageUrls(images, baseUrl);
  const diningProfile = normalizeDiningProfileShape(
    doc.diningProfile && typeof doc.diningProfile === 'object'
      ? doc.diningProfile
      : doc.dining_profile && typeof doc.dining_profile === 'object'
        ? doc.dining_profile
        : {}
  );
`;
if (!s.includes(oldDocToPlaceHead)) throw new Error('docToPlace block not found');
const insert = `/** JSON object from DB - sometimes stored as a string; ignore arrays at root. */
function parseDiningProfileObject(val) {
  if (!val) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Merge diningProfile (sync / camelCase) with dining_profile (business portal).
 * An empty {} in diningProfile must not hide a full dining_profile.
 */
function mergeDiningProfileFromDoc(doc) {
  const camel = parseDiningProfileObject(doc && doc.diningProfile) || {};
  const snake = parseDiningProfileObject(doc && doc.dining_profile) || {};
  return { ...camel, ...snake };
}

`;
const marker = 'function normalizeDiningProfileShape(dp)';
const idx = s.indexOf(marker);
if (idx < 0) throw new Error('marker not found');
const docIdx = s.indexOf('function docToPlace(doc, baseUrl)', idx);
if (docIdx < 0) throw new Error('docToPlace not found');
s = s.slice(0, idx) + insert + s.slice(idx, docIdx) + s.slice(docIdx).replace(oldDocToPlaceHead, `function docToPlace(doc, baseUrl) {
  let images = Array.isArray(doc.images) ? doc.images : [];
  images = resolveImageUrls(images, baseUrl);
  const diningProfile = normalizeDiningProfileShape(mergeDiningProfileFromDoc(doc));
`);
fs.writeFileSync(p, s);
console.log('patched', p);

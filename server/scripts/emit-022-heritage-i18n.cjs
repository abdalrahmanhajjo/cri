#!/usr/bin/env node
/**
 * Builds server/migrations/022_place_category_translations_ar_fr.sql
 * from heritage-i18n-data.cjs (+ part2 if present).
 * Run: node server/scripts/emit-022-heritage-i18n.cjs
 */
const fs = require('fs');
const path = require('path');

const d1 = require('./heritage-i18n-data.cjs');
const d2 = require('./heritage-i18n-data-part2.cjs');

const categories = { ...d1.categories };
const places = { ...d1.places, ...d2.places };

function esc(s) {
  return String(s ?? '').replace(/'/g, "''");
}

let sql = `-- Arabic & French translations for heritage categories and places (see heritage guide).
DELETE FROM place_translations WHERE lang IN ('ar', 'fr');
DELETE FROM category_translations WHERE lang IN ('ar', 'fr');

`;

const catRows = [];
for (const [catId, langs] of Object.entries(categories)) {
  for (const lang of ['ar', 'fr']) {
    const t = langs[lang];
    if (!t) continue;
    catRows.push(
      `('${esc(catId)}','${lang}','${esc(t.name)}','${esc(t.description)}',NULL)`
    );
  }
}
sql += `INSERT INTO category_translations (category_id, lang, name, description, tags) VALUES\n${catRows.join(',\n')};\n\n`;

const placeRows = [];
for (const [id, langs] of Object.entries(places)) {
  for (const lang of ['ar', 'fr']) {
    const t = langs[lang];
    if (!t) continue;
    placeRows.push(
      `('${esc(id)}','${lang}','${esc(t.name)}','${esc(t.description)}','${esc(t.location)}','${esc(t.category)}','${esc(t.duration)}','${esc(t.price)}','${esc(t.bestTime)}')`
    );
  }
}
sql += `-- Rows match places.id only (skips missing IDs if 020 not applied on this DB).
INSERT INTO place_translations (place_id, lang, name, description, location, category, duration, price, best_time, tags)
SELECT v.place_id, v.lang::varchar(5), v.name, v.description, v.location, v.category, v.duration, v.price, v.best_time, NULL::jsonb
FROM (
VALUES
${placeRows.join(',\n')}
) AS v(place_id, lang, name, description, location, category, duration, price, best_time)
INNER JOIN places p ON p.id = v.place_id;
`;

const out = path.join(__dirname, '../migrations/022_place_category_translations_ar_fr.sql');
fs.writeFileSync(out, sql, 'utf8');
console.log('Wrote', out, 'places:', Object.keys(places).length, 'category rows:', catRows.length, 'place rows:', placeRows.length);

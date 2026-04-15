const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/pages/PlaceDining.jsx');
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  /\n  const heroSubtitle = String\(heroLoc\.subtitle \|\| ''\)\.trim\(\) \|\| t\('diningGuide', 'subtitle'\);\n/,
  '\n'
);
s = s.replace(
  /\n  const topPicksTitle =\n    String\(secLoc\.topPicksTitle \|\| ''\)\.trim\(\) \|\| t\('diningGuide', 'topPicksTitle'\);\n/,
  '\n'
);
s = s.replace(/\n            <p className="hg-hero__sub">\{heroSubtitle\}<\/p>\n/, '\n');

const picksBlock = /\n        \{topPicks\.length > 0 \? \([\s\S]*?\) : null\}\n        <section className="hg-toolbar"/;
if (!picksBlock.test(s)) {
  console.error('topPicks block not found');
  process.exit(1);
}
s = s.replace(picksBlock, '\n        <section className="hg-toolbar"');

fs.writeFileSync(p, s);
console.log('PlaceDining.jsx patched');

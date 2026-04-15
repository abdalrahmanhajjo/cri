const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

function patchExplore() {
  const p = path.join(root, 'client/src/pages/Explore.jsx');
  let s = fs.readFileSync(p, 'utf8');
  const neu =
    "            const discoverTo = way.discoverQ ? discoverSearchUrl(way.discoverQ) : discoverSearchUrl('');";
  s = s.replace(/const discoverTo =[\s\S]*?discoverSearchUrl\(''\);/, neu);
  fs.writeFileSync(p, s);
}

function patchFindYourWay() {
  const p = path.join(root, 'client/src/pages/FindYourWay.jsx');
  let s = fs.readFileSync(p, 'utf8');
  const old = /\)\s*:\s*way\.wayKey === 'food' \|\| way\.wayKey === 'stay' \? \([\s\S]*?\)\s*:\s*\(/;
  s = s.replace(old, ') : (');
  fs.writeFileSync(p, s);
}

patchExplore();
patchFindYourWay();
console.log('patched');

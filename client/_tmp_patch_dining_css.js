const fs = require('fs');
const p = 'client/src/pages/PlaceDiningTheme.css';
let s = fs.readFileSync(p, 'utf8');
const old = `.hg-page--dining .hg-stay-card__btn {
  background: linear-gradient(180deg, #fffbf8 0%, #fdeee4 100%);
  color: var(--hg-night);
}

.hg-page--dining .hg-stay-card__btn:hover {
  background: #fce8dc;
}

.hg-page--dining .hg-stay-card__btn--trip {
  border-inline-end-color: rgba(196, 92, 62, 0.12);
}

`;
if (!s.includes(old)) {
  console.error('block not found');
  process.exit(1);
}
s = s.replace(old, '/* Card actions: layout in PlaceHotels.css; dining tints below. */\n\n');
fs.writeFileSync(p, s);
console.log('ok');

import fs from 'fs';

const path = 'client/src/pages/PlaceDetail.jsx';
let s = fs.readFileSync(path, 'utf8');

const marker = 'className="place-detail-btn place-detail-btn--primary"';
const idx = s.indexOf(marker);
if (idx < 0) {
  console.error('marker not found');
  process.exit(1);
}
const slice = s.slice(idx - 200, idx + 350);
console.log(JSON.stringify(slice.slice(0, 400)));

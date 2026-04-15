const fs = require('fs');
const p = 'client/src/pages/PlaceDetail.jsx';
let s = fs.readFileSync(p, 'utf8');
const old1 = `            : {
                name: String(item?.name || '').trim(),
                description: String(item?.description || '').trim(),
                price: String(item?.price || '').trim(),
                badge: String(item?.badge || '').trim(),
              }`;
const new1 = `            : {
                name: String(item?.name || '').trim(),
                description: String(item?.description || '').trim(),
                price: String(item?.price || '').trim(),
                badge: String(item?.badge || '').trim(),
                image: String(item?.image || '').trim(),
              }`;
if (!s.includes(old1)) {
  console.error('menu item block not found');
  process.exit(1);
}
s = s.replace(old1, new1);
s = s.replace(
  '.filter((section) => section.title || section.items.length > 0);',
  '.filter((section) => section.title || section.items.length > 0 || section.note);'
);
fs.writeFileSync(p, s);
console.log('patched PlaceDetail');

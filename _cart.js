const fs = require('fs');
const p = 'client/src/pages/PlaceDetail.jsx';
let s = fs.readFileSync(p, 'utf8');
const rep =
  "section.signatureSection ? (t('business', 'diningSignatureTitle') || 'Signature dishes') : (section.title || '')";
const old1 = 'dishInCart(item, section.title || \'\')';
const old2 = 'handleAddDishToCart(item, section.title || \'\')';
const n1 = 'dishInCart(item, ' + rep + ')';
const n2 = 'handleAddDishToCart(item, ' + rep + ')';
const c0 = (s.match(new RegExp(old1.replace(/[()]/g, '\\$&'), 'g')) || []).length;
s = s.split(old1).join(n1);
s = s.split(old2).join(n2);
fs.writeFileSync(p, s);
console.log('replaced dishInCart occurrences before:', c0);

import fs from "fs";
const p = "client/src/pages/PlaceDiningTheme.css";
let s = fs.readFileSync(p, "utf8");
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
  console.error("remove block not found");
  process.exit(1);
}
s = s.replace(old, "/* Card actions: layout in PlaceHotels.css; dining tints below. */\r\n\r\n");

const insertAfter =
  "/* Card actions: layout in PlaceHotels.css; dining tints below. */\r\n\r\n";
const diningCart = `${insertAfter}.hg-page--dining .hg-stay-card--dining .hg-dining-card__footer--split {
  padding: 10px 12px 12px;
  min-height: 0;
}

.hg-page--dining .hg-stay-card--dining .hg-dining-card__footer--split .hg-stay-card__actions {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border-top: 0;
  background: transparent;
}

.hg-page--dining .hg-stay-card__btn--cart {
  flex: 1;
  justify-content: center;
  color: #fff8f4;
  background: linear-gradient(145deg, #d9773c 0%, #9a3412 55%, #7c2d12 100%);
  border-color: rgba(196, 92, 62, 0.55);
  box-shadow: 0 2px 12px rgba(124, 45, 18, 0.28);
}

.hg-page--dining .hg-stay-card__btn--cart:hover {
  background: linear-gradient(145deg, #ea580c 0%, #c2410c 48%, #9a3412 100%);
  border-color: rgba(234, 88, 12, 0.65);
  color: #fff;
}

.hg-page--dining .hg-stay-card__btn--cart .icon,
.hg-page--dining .hg-stay-card__btn--cart .icon--feather {
  color: inherit;
  flex-shrink: 0;
}

`;

if (!s.includes(insertAfter)) {
  console.error("insert anchor missing");
  process.exit(1);
}
s = s.replace(insertAfter, diningCart);

const cartBlockOld = `/* Cart + map actions - same row height */
.hg-page--dining .hg-stay-card__btn--cart,
.hg-page--dining .hg-stay-card__btn--cart-done {
  border-color: rgba(196, 92, 62, 0.35);
  background: rgba(255, 251, 248, 0.98);
  color: var(--hg-night-mid);
}

`;
if (!s.includes(cartBlockOld)) {
  console.error("cart block old not found");
  process.exit(1);
}
s = s.replace(
  cartBlockOld,
  `/* Cart + map — colors set above; disabled state only */
.hg-page--dining .hg-stay-card__btn--cart-done {
  border-color: rgba(196, 92, 62, 0.35);
  background: rgba(255, 251, 248, 0.98);
  color: var(--hg-night-mid);
}

`,
);

const countOld = `.hg-page--dining .hg-dining-cart-count {
  position: absolute;
  inset-block-start: 6px;
  inset-inline-end: 6px;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1.1rem;
  text-align: center;
  background: rgba(196, 92, 62, 0.95);
  color: #fff;
}
`;

const countNew = `.hg-page--dining .hg-dining-cart-count {
  position: static;
  flex-shrink: 0;
  margin-inline-start: 6px;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1.1rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
}
`;

if (!s.includes(countOld)) {
  console.error("count block not found");
  process.exit(1);
}
s = s.replace(countOld, countNew);

fs.writeFileSync(p, s);
console.log("PlaceDiningTheme.css updated");

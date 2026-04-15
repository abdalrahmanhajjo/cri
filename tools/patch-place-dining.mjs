import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const p = path.join(root, 'client/src/pages/PlaceDining.jsx');
let s = fs.readFileSync(p, 'utf8');

const block = `function formatTripRange(trip, locale) {
  const a = trip.startDate ? new Date(trip.startDate) : null;
  const b = trip.endDate ? new Date(trip.endDate) : null;
  if (!a || Number.isNaN(a.getTime())) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!b || Number.isNaN(b.getTime())) return a.toLocaleDateString(locale, opts);
  return \`\${a.toLocaleDateString(locale, opts)} – \${b.toLocaleDateString(locale, opts)}\`;
}

`;

if (s.includes('function formatTripRange')) {
  s = s.replace(block, '');
}

s = s.replace(
  "import { getDayCount, ensureDaysArray, toDateOnly, sortPlacesForItinerary, tripDaysPlaceIdsOnlyToPayload } from '../utils/tripPlannerHelpers';\n",
  ''
);
s = s.replace(
  "import DiningFlowRibbon from '../components/DiningFlowRibbon';\n",
  "import DiningFlowRibbon from '../components/DiningFlowRibbon';\nimport { getMealCart, addMealToCart as pushMealToCart, removeMealFromCart } from '../utils/diningMealCart';\n"
);

const offerFn = `
function diningOfferTeaser(place) {
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const note = String(dp.menuNote || '').trim();
  const tagBits = Array.isArray(place.tags) ? place.tags.map((x) => String(x)) : [];
  const offerish = (txt) =>
    /(offer|deal|special|promo|happy|set menu|menu du jour|ladies|night|%|discount|free)/i.test(String(txt));
  if (note && offerish(note)) {
    return note.length > 160 ? \`\${note.slice(0, 157)}…\` : note;
  }
  const fromTags = tagBits.filter((t) => offerish(t));
  if (fromTags.length) return fromTags.slice(0, 3).join(' · ');
  if (note) return note.length > 160 ? \`\${note.slice(0, 157)}…\` : note;
  return '';
}
`;

if (!s.includes('function diningOfferTeaser')) {
  s = s.replace(
    'function matchesDiningFlow(place, flow) {',
    `${offerFn}\nfunction matchesDiningFlow(place, flow) {`
  );
}

fs.writeFileSync(p, s);
console.log('patch-place-dining: imports + diningOfferTeaser ok');

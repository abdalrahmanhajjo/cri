const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/pages/PlaceDining.jsx');
let s = fs.readFileSync(p, 'utf8');

const patches = [];

if (!s.includes('GuideExperienceBand')) {
  s = s.replace(
    "import DiningFlowRibbon from '../components/DiningFlowRibbon';\nimport './PlaceHotels.css';",
    "import DiningFlowRibbon from '../components/DiningFlowRibbon';\nimport GuideExperienceBand from '../components/GuideExperienceBand';\nimport './PlaceHotels.css';"
  );
  patches.push('import');
}

if (!s.includes('function serviceModeLabel')) {
  s = s.replace(
    "const DINING_PLACE_HASH = '#place-dining-heading';\n\nfunction DiningListingCard",
    `const DINING_PLACE_HASH = '#place-dining-heading';

function serviceModeLabel(token, t) {
  const k = String(token || '').toLowerCase();
  const id =
    k === 'delivery'
      ? 'svcDelivery'
      : k === 'takeaway'
        ? 'svcTakeaway'
        : k === 'reservations'
          ? 'svcReservations'
          : k === 'outdoor seating'
            ? 'svcOutdoor'
            : null;
  return id ? t('diningGuide', id) : token;
}

function DiningListingCard`
  );
  patches.push('serviceModeLabel');
}

fs.writeFileSync(p, s);
console.log('patched:', patches.join(', ') || 'none');

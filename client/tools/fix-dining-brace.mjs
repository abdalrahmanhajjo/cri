import fs from 'fs';

const p = new URL('../src/pages/PlaceDining.jsx', import.meta.url);
let c = fs.readFileSync(p, 'utf8');
const bad = `  };

function matchesDiningFlow(place, flow) {
  if (!flow) return true;
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const sig = diningSignals(place);
  if (flow === 'reserve') return Boolean(dp.reservations);
  if (flow === 'order') return Boolean(dp.delivery || dp.takeaway);
  if (flow === 'menu') return Boolean(sig.hasMenu);
  if (flow === 'offers') {
    const tags = Array.isArray(place.tags) ? place.tags.join(' ') : String(place.tags || '');
    const hay = \`\${place.name || ''} \${tags} \${String(dp.menuNote || '')}\`.toLowerCase();
    return /(offer|deal|special|promo|happy|set menu|menu du jour|ladies|night)/.test(hay);
  }
  return true;
}
}

function isLikelyDiningPlace`;
const good = `  };
}

function matchesDiningFlow(place, flow) {
  if (!flow) return true;
  const dp = place?.diningProfile && typeof place.diningProfile === 'object' ? place.diningProfile : {};
  const sig = diningSignals(place);
  if (flow === 'reserve') return Boolean(dp.reservations);
  if (flow === 'order') return Boolean(dp.delivery || dp.takeaway);
  if (flow === 'menu') return Boolean(sig.hasMenu);
  if (flow === 'offers') {
    const tags = Array.isArray(place.tags) ? place.tags.join(' ') : String(place.tags || '');
    const hay = \`\${place.name || ''} \${tags} \${String(dp.menuNote || '')}\`.toLowerCase();
    return /(offer|deal|special|promo|happy|set menu|menu du jour|ladies|night)/.test(hay);
  }
  return true;
}

function isLikelyDiningPlace`;
if (!c.includes(bad)) {
  console.error('pattern not found');
  process.exit(1);
}
fs.writeFileSync(p, c.replace(bad, good));
console.log('fixed');

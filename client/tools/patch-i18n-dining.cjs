const fs = require('fs');
const p = 'client/src/i18n/translations.js';
let c = fs.readFileSync(p, 'utf8');
const a = "experienceCol2Body: 'Jump to the map from any place, or use the dining and hotel guides for deeper, focused lists.'";
const b =
  "experienceCol2Body:\r\n        'Open the map from any place for context, or use Dining and Stays in the nav when you want a shorter, focused list.'";
if (!c.includes(a)) {
  console.error('col2 missing');
  process.exit(1);
}
c = c.replace(a, b);
const oldBlock =
  "      sponsoredSectionLead: 'Places supporting the guide — clearly marked. Tap through like any other listing.',\r\n    },\r\n    hotelGuide: {";
const newBlock =
  "      sponsoredSectionLead: 'Places supporting the guide — clearly marked. Tap through like any other listing.',\r\n      flowSectionLabel: 'Dining paths',\r\n      flowTitle: 'Reserve, order, or browse',\r\n      flowLead:\r\n        'Choose a step to filter the list. Open any card for phone, menu, offers on the place page, and trip actions.',\r\n      flowLabel_all: 'All dining',\r\n      flowHint_all: 'Full list with your search and filters',\r\n      flowLabel_reserve: 'Book a table',\r\n      flowHint_reserve: 'Places that accept reservations',\r\n      flowLabel_order: 'Order ahead',\r\n      flowHint_order: 'Delivery or takeaway where listed',\r\n      flowLabel_menu: 'Menus & set meals',\r\n      flowHint_menu: 'Listings with a menu or set-meal note',\r\n      flowLabel_offers: 'Deals & specials',\r\n      flowHint_offers: 'Keywords like offers, specials, or promos in the listing',\r\n      flowEmpty:\r\n        'No places match this step with your current search. Clear the search or try another step.',\r\n    },\r\n    hotelGuide: {";
if (!c.includes(oldBlock)) {
  console.error('sponsored block missing');
  process.exit(1);
}
c = c.replace(oldBlock, newBlock);
fs.writeFileSync(p, c);
console.log('translations patched');

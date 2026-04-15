import fs from 'fs';
function patch(path, fn) {
  let c = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  c = fn(c);
  fs.writeFileSync(path, c.replace(/\n/g, '\r\n'));
}

patch('client/src/pages/PlaceHotels.jsx', (c) => {
  c = c.replace(
    "import GuideExperienceBand from '../components/GuideExperienceBand';\n",
    ''
  );
  c = c.replace(/\n\s*<GuideExperienceBand t=\{t\} ns="hotelGuide" \/>\n/, '\n');
  return c;
});

patch('client/src/pages/PlaceDiscover.jsx', (c) => {
  c = c.replace(
    "import GuideExperienceBand from '../components/GuideExperienceBand';\n",
    ''
  );
  c = c.replace(
    "import { DINING_PATH, HOTELS_PATH } from '../utils/discoverPaths';\n",
    ''
  );
  const block = /\{\(diningGuideEnabled \|\| hotelsGuideEnabled\) && \([\s\S]*?<\/div>\s*\)\}\s*\n/;
  c = c.replace(block, '');
  c = c.replace(/\n\s*<GuideExperienceBand t=\{t\} ns="placeDiscover" \/>\n/, '\n');
  c = c.replace(
    /  const diningGuideEnabled = settings\?\.diningGuide\?\.enabled !== false;\n  const hotelsGuideEnabled = settings\?\.hotelsGuide\?\.enabled !== false;\n\n/g,
    ''
  );
  c = c.replace(
    /  const sponsoredDiscoverEnabled = settings\?\.sponsoredPlacesEnabled\?\.discover !== false;\n/g,
    (m) => m
  );
  return c;
});

console.log('ok');

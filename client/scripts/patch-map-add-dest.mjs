import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'src', 'pages', 'Map.jsx');
let s = fs.readFileSync(file, 'utf8');

const a = `  const listForDrawer = useMemo(() => {
    if (nearbyMode === 'off') return drawerPlaces;
    if (nearbyMode === 'me' && nearbyLocating) return [];
    return nearbyAnchoredList != null ? nearbyAnchoredList : [];
  }, [nearbyMode, nearbyLocating, nearbyAnchoredList, drawerPlaces]);`;

const b = `  const listForDrawer = useMemo(() => {
    if (addingTripStop || nearbyMode === 'off') return drawerPlaces;
    if (nearbyMode === 'me' && nearbyLocating) return [];
    return nearbyAnchoredList != null ? nearbyAnchoredList : [];
  }, [addingTripStop, nearbyMode, nearbyLocating, nearbyAnchoredList, drawerPlaces]);`;

if (!s.includes(a)) {
  console.error('listForDrawer block not found');
  process.exit(1);
}
s = s.replace(a, b);

const c = `                    onClick={() => {
                      setAddingTripStop(true);
                      setListOpen(true);
                    }}`;

const d = `                    onClick={() => {
                      setAddingTripStop(true);
                      setListOpen(true);
                      setNearbyMode('off');
                    }}`;

if (!s.includes(c)) {
  console.error('add destination onClick not found');
  process.exit(1);
}
s = s.replace(c, d);

fs.writeFileSync(file, s, 'utf8');
console.log('patched', file);

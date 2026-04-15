const fs = require('fs');
const p = 'client/src/pages/business/BusinessPlaceFeed.jsx';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('useSearchParams')) {
  s = s.replace(
    "import { useOutletContext } from 'react-router-dom';",
    "import { useOutletContext, useSearchParams } from 'react-router-dom';"
  );
}
if (!s.includes('const [searchParams] = useSearchParams()')) {
  s = s.replace(
    '  const places = useMemo(() => (Array.isArray(me?.places) ? me.places : []), [me?.places]);',
    `  const [searchParams] = useSearchParams();
  const places = useMemo(() => (Array.isArray(me?.places) ? me.places : []), [me?.places]);`
  );
}
const inject = `
  useEffect(() => {
    const pid = String(searchParams.get('placeId') || searchParams.get('place') || '').trim();
    if (!pid) return;
    const allowed = places.some((p) => String(p.id) === pid);
    if (allowed) setPlaceFilter(pid);
  }, [searchParams, places]);
`;
if (!s.includes("searchParams.get('placeId')")) {
  s = s.replace(
    "  const [placeFilter, setPlaceFilter] = useState('');",
    `  const [placeFilter, setPlaceFilter] = useState('');${inject}`
  );
}
fs.writeFileSync(p, s);

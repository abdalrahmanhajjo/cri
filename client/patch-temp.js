const fs = require('fs');
const p = 'src/pages/business/BusinessPlaceFeed.jsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes("from '../../context/AuthContext'")) {
  s = s.replace(
    "import './Business.css';",
    "import './Business.css';\nimport { useAuth } from '../../context/AuthContext';"
  );
}

const block1 = `  const places = useMemo(() => (Array.isArray(me?.places) ? me.places : []), [me?.places]);

  const [posts, setPosts] = useState([]);`;

const block2 = `  const places = useMemo(() => (Array.isArray(me?.places) ? me.places : []), [me?.places]);
  const { user } = useAuth();
  const isAdminUser = user?.isAdmin === true;
  const meIsAdmin = me?.isAdmin === true;

  const [venuePickQuery, setVenuePickQuery] = useState('');
  const [captionSearch, setCaptionSearch] = useState('');
  const [captionDebounced, setCaptionDebounced] = useState('');

  const filteredVenueOptions = useMemo(() => {
    const q = venuePickQuery.trim().toLowerCase();
    if (!q) return places;
    const hit = places.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const loc = String(p.location || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      return name.includes(q) || loc.includes(q) || cat.includes(q);
    });
    return hit.length ? hit : places;
  }, [places, venuePickQuery]);

  const [posts, setPosts] = useState([]);`;

if (s.includes(block1) && !s.includes('venuePickQuery')) {
  s = s.replace(block1, block2);
}

const loadOld = `  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (placeFilter) params.placeId = placeFilter;
      if (formatFilter && formatFilter !== 'all') params.format = formatFilter;
      const r = await api.business.feed.list(params);
      setPosts(r.posts || []);
    } catch (e) {
      setError(e.message || 'Could not load posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [placeFilter, formatFilter]);`;

const loadNew = `  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (placeFilter) params.placeId = placeFilter;
      if (formatFilter && formatFilter !== 'all') params.format = formatFilter;
      const cq = captionDebounced.trim();
      if (cq.length >= 2) params.q = cq;
      const r = await api.business.feed.list(params);
      setPosts(r.posts || []);
    } catch (e) {
      setError(e.message || 'Could not load posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [placeFilter, formatFilter, captionDebounced]);`;

if (s.includes(loadOld)) {
  s = s.replace(loadOld, loadNew);
}

const effOld = `  useEffect(() => {
    load();
  }, [load]);`;

const effNew = `  useEffect(() => {
    const t = window.setTimeout(() => setCaptionDebounced(captionSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [captionSearch]);

  useEffect(() => {
    load();
  }, [load]);`;

if (s.includes(effOld) && !s.includes('setCaptionDebounced')) {
  s = s.replace(effOld, effNew);
}

fs.writeFileSync(p, s);
console.log('done');

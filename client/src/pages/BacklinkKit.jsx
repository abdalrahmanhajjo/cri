import { useEffect, useMemo, useState } from 'react';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import './css/BacklinkKit.css';

const TARGETS = [
  {
    anchor: 'Visit Tripoli',
    url: 'https://visit-tripoli.com/',
  },
  {
    anchor: 'things to do in Tripoli Lebanon',
    url: 'https://visit-tripoli.com/things-to-do-in-tripoli-lebanon',
  },
  {
    anchor: 'Tripoli old city guide',
    url: 'https://visit-tripoli.com/tripoli-old-city-guide',
  },
  {
    anchor: 'Tripoli souks guide',
    url: 'https://visit-tripoli.com/tripoli-souks-guide',
  },
  {
    anchor: 'best sweets in Tripoli',
    url: 'https://visit-tripoli.com/best-sweets-in-tripoli',
  },
];

function htmlSnippet(anchor, url) {
  return `<a href="${url}" target="_blank" rel="noopener">` + anchor + `</a>`;
}

export default function BacklinkKit() {
  const { lang } = useLanguage();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.places
      .list({ lang: langParam })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.locations) ? res.locations : Array.isArray(res?.popular) ? res.popular : [];
        setPlaces(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setPlaces([]);
        setError(e?.message || 'Could not load places');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  const outreachText = useMemo(
    () =>
      `Hello,\n\nWe are sharing official Visit Tripoli visitor resources for travelers to Tripoli, Lebanon.\nPlease add one of these links on your website resources page using the suggested anchor text.\n\nThank you.`,
    []
  );

  const dbBacklinks = useMemo(() => {
    return places
      .map((p) => {
        const slug = String(p.searchName || p.search_name || p.id || '')
          .trim()
          .toLowerCase();
        if (!slug) return null;
        const url = `https://visit-tripoli.com/place/${encodeURIComponent(slug)}`;
        const image = getPlaceImageUrl(p.image) || getPlaceImageUrl(Array.isArray(p.images) ? p.images[0] : '');
        return {
          id: String(p.id || slug),
          name: String(p.name || slug),
          location: String(p.location || 'Tripoli, Lebanon'),
          anchor: `${String(p.name || slug)} in Tripoli`,
          url,
          image,
        };
      })
      .filter(Boolean)
      .slice(0, 18);
  }, [places]);

  return (
    <div className="backlink-kit">
      <div className="backlink-kit__mesh" aria-hidden />
      <div className="backlink-kit__container">
        <header className="backlink-kit__hero">
          <p className="backlink-kit__eyebrow">Partner Link Kit</p>
          <h1>Official backlinks for Visit Tripoli</h1>
          <p>
            Use these exact destination URLs and anchor texts on municipality, university, venue, and event pages.
            This is the recommended set to strengthen Tripoli search visibility.
          </p>
        </header>

        <section className="backlink-kit__cards" aria-label="Backlink targets">
          {TARGETS.map((item) => (
            <article key={item.url} className="backlink-kit__card">
              <h2>{item.anchor}</h2>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="backlink-kit__url">
                {item.url}
              </a>
              <label>HTML snippet</label>
              <pre>{htmlSnippet(item.anchor, item.url)}</pre>
            </article>
          ))}
        </section>

        <section className="backlink-kit__dbSection" aria-label="Live place backlink database">
          <div className="backlink-kit__dbHead">
            <h2>Live place backlink database</h2>
            <p>Generated from your real places in database (with image, location, URL, and HTML snippet).</p>
          </div>
          {loading && <p className="backlink-kit__state">Loading places…</p>}
          {!loading && error && <p className="backlink-kit__state backlink-kit__state--err">{error}</p>}
          {!loading && !error && dbBacklinks.length === 0 && (
            <p className="backlink-kit__state">No places found in database.</p>
          )}
          {!loading && !error && dbBacklinks.length > 0 && (
            <div className="backlink-kit__dbGrid">
              {dbBacklinks.map((item) => (
                <article key={item.id} className="backlink-kit__dbCard">
                  <div className="backlink-kit__dbImage" role="img" aria-label={item.name}>
                    {item.image ? (
                      <DeliveryImg url={item.image} preset="backlinkDb" alt="" />
                    ) : null}
                  </div>
                  <div className="backlink-kit__dbBody">
                    <h3>{item.name}</h3>
                    <p>{item.location}</p>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="backlink-kit__url">
                      {item.url}
                    </a>
                    <label>HTML snippet</label>
                    <pre>{htmlSnippet(item.anchor, item.url)}</pre>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="backlink-kit__outreach" aria-label="Outreach template">
          <h2>Outreach message template</h2>
          <pre>{outreachText}</pre>
        </section>
      </div>
    </div>
  );
}


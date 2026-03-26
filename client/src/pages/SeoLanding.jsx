import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import './SeoLanding.css';

function placeSlug(place) {
  return String(place?.searchName || place?.search_name || place?.id || '')
    .trim()
    .toLowerCase();
}

function Page({ title, intro, sections, links, dbTitle = 'Featured places from database' }) {
  const { t, lang } = useLanguage();
  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [placesError, setPlacesError] = useState('');
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';

  useEffect(() => {
    let cancelled = false;
    setLoadingPlaces(true);
    setPlacesError('');
    api.places
      .list({ lang: langParam })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.locations)
          ? res.locations
          : Array.isArray(res?.popular)
            ? res.popular
            : [];
        setPlaces(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setPlaces([]);
        setPlacesError(e?.message || 'Could not load places');
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaces(false);
      });
    return () => {
      cancelled = true;
    };
  }, [langParam]);

  const dbPlaces = useMemo(() => {
    const bySlug = new Map(
      (places || [])
        .map((p) => [placeSlug(p), p])
        .filter(([slug]) => Boolean(slug))
    );
    const fromLinks = (links || [])
      .map((l) => {
        const slug = String(l.to || '')
          .replace(/^\/place\//, '')
          .trim()
          .toLowerCase();
        return bySlug.get(slug) || null;
      })
      .filter(Boolean);
    if (fromLinks.length > 0) return fromLinks.slice(0, 8);
    return (places || []).slice(0, 8);
  }, [places, links]);

  return (
    <div className="seo-landing">
      <div className="seo-landing__container">
        <header className="seo-landing__header">
          <h1 className="seo-landing__title">{title}</h1>
          <p className="seo-landing__intro">{intro}</p>
        </header>

        <div className="seo-landing__grid">
          <main className="seo-landing__main">
            {sections.map((s) => (
              <section key={s.id} className="seo-landing__section" aria-labelledby={s.id}>
                <h2 id={s.id} className="seo-landing__h2">{s.h}</h2>
                {s.p.map((txt, i) => (
                  <p key={i} className="seo-landing__p">{txt}</p>
                ))}
              </section>
            ))}
          </main>

          <aside className="seo-landing__side" aria-label="Helpful links">
            <div className="seo-landing__card">
              <h2 className="seo-landing__sideTitle">{t('nav', 'visitTripoli') || 'Visit Tripoli'}</h2>
              <p className="seo-landing__sideP">
                {t('nav', 'navBrandTagline') || 'Places, experiences & events'}
              </p>
              <div className="seo-landing__ctaRow">
                <Link to="/discover" className="seo-landing__btn seo-landing__btn--primary">
                  {t('nav', 'discoverPlaces') || 'Discover'}
                </Link>
                <Link to="/activities" className="seo-landing__btn seo-landing__btn--ghost">
                  {t('nav', 'activitiesHubNav') || 'Activities'}
                </Link>
              </div>
            </div>

            <div className="seo-landing__card">
              <h3 className="seo-landing__sideTitleSm">Top places</h3>
              <ul className="seo-landing__list">
                {links.map((l) => (
                  <li key={l.to} className="seo-landing__li">
                    <Link to={l.to} className="seo-landing__link">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <section className="seo-landing__dbSection" aria-label={dbTitle}>
          <div className="seo-landing__dbHead">
            <h2>{dbTitle}</h2>
            <p>Live venue cards generated from your actual database entries.</p>
          </div>
          {loadingPlaces && <p className="seo-landing__dbState">Loading places…</p>}
          {!loadingPlaces && placesError && (
            <p className="seo-landing__dbState seo-landing__dbState--err">{placesError}</p>
          )}
          {!loadingPlaces && !placesError && dbPlaces.length === 0 && (
            <p className="seo-landing__dbState">No places found.</p>
          )}
          {!loadingPlaces && !placesError && dbPlaces.length > 0 && (
            <div className="seo-landing__dbGrid">
              {dbPlaces.map((p) => {
                const slug = placeSlug(p);
                const to = `/place/${encodeURIComponent(slug)}`;
                const img =
                  getPlaceImageUrl(p.image) ||
                  getPlaceImageUrl(Array.isArray(p.images) ? p.images[0] : '');
                return (
                  <article key={slug} className="seo-landing__dbCard">
                    <Link
                      to={to}
                      className="seo-landing__dbMedia"
                      style={img ? { backgroundImage: `url(${img})` } : undefined}
                      aria-label={p.name || slug}
                    />
                    <div className="seo-landing__dbBody">
                      <h3>{p.name || slug}</h3>
                      <p>{p.location || 'Tripoli, Lebanon'}</p>
                      <Link to={to} className="seo-landing__dbCta">View place</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="seo-landing__footer">
          <p className="seo-landing__footerP">
            {t('nav', 'tripoliLebanon') || 'Tripoli, Lebanon'} ·{' '}
            <Link to="/" className="seo-landing__footerLink">{t('nav', 'home') || 'Home'}</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

const placeLinks = [
  { to: '/place/clock_tower', label: 'Clock Tower' },
  { to: '/place/great_mosque_tripoli', label: 'Great Mosque of Tripoli' },
  { to: '/place/taynal_mosque', label: 'Taynal Mosque' },
  { to: '/place/spice_market', label: 'Spice Market' },
  { to: '/place/hallab_sweets', label: 'Hallab Sweets' },
];

export function ThingsToDoTripoli() {
  return (
    <Page
      title="Things to do in Tripoli, Lebanon"
      intro="Tripoli is Lebanon’s northern coastal city — famous for historic souks, beautiful mosques, traditional sweets, and a walkable old city. Here are the best things to do for a first visit."
      links={placeLinks}
      sections={[
        {
          id: 'old-city',
          h: 'Explore the Old City and souks',
          p: [
            'Start in the old city to see the khans, covered markets, and craft workshops. The best way is to walk slowly and follow the alleys from one souk to the next.',
            'If you only have a few hours, focus on the spice market, the soap khans, and one major landmark — you’ll still get a real feel for Tripoli.',
          ],
        },
        {
          id: 'mosques',
          h: 'Visit historic mosques and architecture',
          p: [
            'Tripoli’s architecture is a highlight: stone courtyards, arches, carved doors, and quiet interior spaces.',
            'Choose one or two key sites and visit respectfully. Early day is usually best for photos and comfort.',
          ],
        },
        {
          id: 'food',
          h: 'Try Tripoli’s food and sweets',
          p: [
            'Tripoli is the sweets capital of Lebanon. Try a classic shop, then compare with a smaller bakery for something different.',
            'Pair the sweets with Arabic coffee or tea and enjoy the city’s slower pace.',
          ],
        },
        {
          id: 'plan',
          h: 'Plan a simple half-day itinerary',
          p: [
            'Half-day plan: Clock Tower → souks walk → a landmark mosque → sweets stop.',
            'Full-day plan: add a guided tour, a cultural stop, and an evening meal.',
          ],
        },
      ]}
    />
  );
}

export function OldCityGuide() {
  return (
    <Page
      title="Tripoli Old City guide (Lebanon)"
      intro="The old city is the heart of Tripoli: narrow streets, historic buildings, and the liveliest markets in North Lebanon. Use this guide to plan your walk."
      links={placeLinks}
      sections={[
        {
          id: 'start',
          h: 'Where to start',
          p: [
            'A simple starting point is the central clock tower area, then continue into the souks on foot.',
            'Wear comfortable shoes: the best parts of the old city are discovered by walking.',
          ],
        },
        {
          id: 'souks',
          h: 'Souks, khans, and crafts',
          p: [
            'Tripoli’s khans (historic caravanserais) are some of the city’s most atmospheric spaces.',
            'Look for soap, spices, copper and small gifts — and don’t be afraid to ask shopkeepers about the history of the area.',
          ],
        },
        {
          id: 'tips',
          h: 'Local tips',
          p: [
            'Go earlier in the day if you want a calmer walk, or late afternoon if you want to see the markets at their busiest.',
            'Bring small cash for snacks and small purchases.',
          ],
        },
      ]}
    />
  );
}

export function SouksGuide() {
  return (
    <Page
      title="Tripoli Souks guide: markets, spices & crafts"
      intro="Tripoli’s souks are a living heritage: spices, soap, textiles, and everyday shopping in historic streets. This guide helps you choose what to see and what to buy."
      links={placeLinks}
      sections={[
        {
          id: 'spices',
          h: 'Spice market highlights',
          p: [
            'The spice market is one of the easiest places to feel the energy of the old city — colorful stalls, aromas, and local ingredients.',
            'Ask vendors what’s seasonal and what locals buy for home cooking.',
          ],
        },
        {
          id: 'soap',
          h: 'Soap and traditional products',
          p: [
            'Tripoli is known for traditional soap-making. Khans connected to soap trade are worth a visit even if you don’t buy anything.',
            'Look for handmade soaps and simple natural products as practical souvenirs.',
          ],
        },
        {
          id: 'crafts',
          h: 'Crafts and small gifts',
          p: [
            'Copper and small craft shops can be found throughout the souks. Even a short walk can be rewarding.',
            'If you find something you like, it’s okay to compare prices — but keep it friendly.',
          ],
        },
      ]}
    />
  );
}

export function SweetsGuide() {
  return (
    <Page
      title="Best sweets in Tripoli, Lebanon"
      intro="Tripoli’s sweets are famous across Lebanon. Use this guide to pick a classic shop, understand what to try, and plan the perfect tasting walk."
      links={placeLinks}
      sections={[
        {
          id: 'what',
          h: 'What to try',
          p: [
            'Start with one classic selection, then try one new item you’ve never heard of. Tripoli’s variety is the fun part.',
            'If you’re not sure, ask for a small mixed box. Most shops are used to visitors and can recommend favorites.',
          ],
        },
        {
          id: 'where',
          h: 'Where to go',
          p: [
            'Choose a famous sweet shop first, then try a smaller bakery for a different style.',
            'Go earlier in the day for fresher selection and an easier walk.',
          ],
        },
        {
          id: 'pair',
          h: 'Pair it with a city walk',
          p: [
            'A sweets stop works best after a souk walk or a landmark visit. That way, the tasting is part of the day, not the whole day.',
            'If you’re taking sweets back as gifts, ask for travel-friendly packaging.',
          ],
        },
      ]}
    />
  );
}

export function TravelTipsTripoli() {
  return (
    <Page
      title="Tripoli, Lebanon travel tips"
      intro="Simple travel tips to make your Tripoli day smooth: what to wear, when to go, and how to plan a safe, comfortable walk through the old city."
      links={placeLinks}
      sections={[
        {
          id: 'when',
          h: 'Best time to visit',
          p: [
            'Spring and autumn are generally the most comfortable for walking.',
            'For the old city, daylight hours are ideal for navigation and photos.',
          ],
        },
        {
          id: 'walk',
          h: 'Getting around',
          p: [
            'The old city is best explored on foot. Save driving for longer distances outside the core markets.',
            'Plan one “anchor” point (like the clock tower) and do loops from there.',
          ],
        },
        {
          id: 'respect',
          h: 'Respectful visiting',
          p: [
            'Dress modestly when visiting religious sites and ask before taking photos of people.',
            'If you feel lost, ask shopkeepers — people are often happy to guide you.',
          ],
        },
      ]}
    />
  );
}

export function AboutTripoli() {
  const { t } = useLanguage();
  const highlights = [
    {
      title: 'Historic Core',
      text: 'A living old city with Mamluk-era streets, mosques, khans, and markets still active today.',
    },
    {
      title: 'Craft & Trade Heritage',
      text: 'Soap, spices, sweets, and small workshops preserve Tripoli’s long merchant tradition.',
    },
    {
      title: 'Authentic Urban Energy',
      text: 'Tripoli blends heritage with everyday life: not a museum city, but a real city to experience.',
    },
    {
      title: 'Gateway of North Lebanon',
      text: 'A strategic base for exploring culture, coast, and communities across northern Lebanon.',
    },
  ];

  const quickFacts = [
    'One of the oldest continuously inhabited cities on the Mediterranean',
    'Known for landmark mosques, khans, and Ottoman/Mamluk urban fabric',
    'Famous across Lebanon for traditional sweets and old souk culture',
    'A walkable destination for history-led cultural travel',
  ];

  const visualPanels = [
    {
      title: 'Historic Souks',
      text: 'Layered markets, arches, and daily life in the old city core.',
      image: '/home-bento/oldsouk.png',
    },
    {
      title: 'Coastal Identity',
      text: 'A Mediterranean city where heritage and sea routes shaped commerce.',
      image: '/home-bento/sea.png',
    },
    {
      title: 'Cultural Continuity',
      text: 'Tripoli keeps traditions alive through craft, food, and neighborhood rhythm.',
      image: '/city.png',
    },
  ];

  const keyMetrics = [
    { value: '1000+', label: 'Years of urban history' },
    { value: '50+', label: 'Notable heritage landmarks' },
    { value: '4', label: 'Core visitor themes: culture, souks, food, coast' },
    { value: 'Half-day+', label: 'Suggested time for old city highlights' },
  ];

  return (
    <div className="seo-landing seo-landing--about">
      <div className="seo-landing__aboutGlow" aria-hidden />
      <div className="seo-landing__container">
        <header className="seo-landing__aboutHero">
          <p className="seo-landing__aboutEyebrow">{t('nav', 'megaAboutTripoli') || 'About Tripoli'}</p>
          <h1 className="seo-landing__title">About Tripoli, Lebanon</h1>
          <p className="seo-landing__intro">
            Tripoli is a Mediterranean city of memory and movement. Its old streets carry deep history, while its
            souks, workshops, and neighborhoods keep the city present-tense and alive. This overview introduces the
            spirit, heritage, and visitor value of Tripoli in one page.
          </p>
        </header>

        <section className="seo-landing__aboutVisualGrid" aria-label="Tripoli visual overview">
          {visualPanels.map((panel) => (
            <article key={panel.title} className="seo-landing__aboutVisualCard">
              <div
                className="seo-landing__aboutVisualMedia"
                style={{ backgroundImage: `url(${panel.image})` }}
                role="img"
                aria-label={panel.title}
              />
              <div className="seo-landing__aboutVisualBody">
                <h2>{panel.title}</h2>
                <p>{panel.text}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="seo-landing__aboutMetrics" aria-label="Tripoli at a glance">
          {keyMetrics.map((m) => (
            <div key={m.label} className="seo-landing__aboutMetric">
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </section>

        <section className="seo-landing__aboutBand" aria-label="Tripoli overview highlights">
          {highlights.map((item) => (
            <article key={item.title} className="seo-landing__aboutCard">
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="seo-landing__aboutNarrative" aria-labelledby="tripoli-overview-story">
          <h2 id="tripoli-overview-story" className="seo-landing__h2">City overview</h2>
          <p className="seo-landing__p">
            Tripoli has long connected people, craft, scholarship, and trade. Its historic center is known for layered
            architecture and civic landmarks, but what makes the city special is continuity: markets still function,
            families still produce local foods, and neighborhoods still carry identity through everyday routines.
          </p>
          <p className="seo-landing__p">
            For visitors, Tripoli offers high cultural density in a compact urban footprint. You can discover landmark
            spaces, traditional streets, and strong local hospitality in a single day, then return for deeper
            exploration through food, craft, and community life.
          </p>
        </section>

        <section className="seo-landing__aboutFacts" aria-label="Quick facts">
          <h2 className="seo-landing__h2">Quick facts</h2>
          <ul className="seo-landing__aboutList">
            {quickFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}


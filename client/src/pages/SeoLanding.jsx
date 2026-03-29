import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import './SeoLanding.css';

function placeSlug(place) {
  return String(place?.searchName || place?.search_name || place?.id || '')
    .trim()
    .toLowerCase();
}

function Page({ title, intro, sections, dbTitle = 'Featured places from database' }) {
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
    const list = places || [];
    const withSlug = list
      .map((p) => ({ p, slug: placeSlug(p) }))
      .filter((x) => Boolean(x.slug));
    return withSlug.slice(0, 8).map((x) => x.p);
  }, [places]);

  const sidebarPlaces = useMemo(() => dbPlaces.slice(0, 6), [dbPlaces]);

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
                {t('nav', 'navBrandTagline') || 'Best spots, experiences & plans'}
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
              {loadingPlaces && <p className="seo-landing__sideP">Loading…</p>}
              {!loadingPlaces && sidebarPlaces.length === 0 && (
                <p className="seo-landing__sideP">Browse the directory for venues.</p>
              )}
              {!loadingPlaces && sidebarPlaces.length > 0 && (
                <ul className="seo-landing__list">
                  {sidebarPlaces.map((p) => {
                    const slug = placeSlug(p);
                    const to = `/place/${encodeURIComponent(slug)}`;
                    return (
                      <li key={slug} className="seo-landing__li">
                        <Link to={to} className="seo-landing__link">
                          {p.name || slug}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                    <Link to={to} className="seo-landing__dbMedia" aria-label={p.name || slug}>
                      {img ? <DeliveryImg url={img} preset="seoDb" alt="" /> : null}
                    </Link>
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

export function ThingsToDoTripoli() {
  return (
    <Page
      title="Things to do in Tripoli, Lebanon"
      intro="Tripoli is Lebanon’s northern coastal city — famous for historic souks, beautiful mosques, traditional sweets, and a walkable old city. Here are the best things to do for a first visit."
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
  const tt = (key, fallback) => t('aboutTripoli', key) || fallback;
  // Lightweight scroll reveal (no big libraries)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    if (els.length === 0) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) {
      els.forEach((el) => el.setAttribute('data-revealed', 'true'));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute('data-revealed', 'true');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const highlights = [
    {
      title: tt('highlights_layered_title', 'A city of layered eras'),
      text: tt(
        'highlights_layered_text',
        'Tripoli’s identity was shaped by port routes, medieval states, Mamluk architecture, Ottoman commerce, and modern Lebanese life — all visible within a compact walk.'
      ),
    },
    {
      title: tt('highlights_arch_title', 'Architecture that tells stories'),
      text: tt(
        'highlights_arch_text',
        'Courtyards, stone arches, khans, mosques, and hammams are not “ruins” — they’re living urban rooms that still guide movement and community rhythm.'
      ),
    },
    {
      title: tt('highlights_markets_title', 'Markets that never stopped'),
      text: tt(
        'highlights_markets_text',
        'Souks remain functional and human-scale. The city’s merchant tradition continues through craft, food, and micro‑businesses passed down across generations.'
      ),
    },
    {
      title: tt('highlights_continuity_title', 'Culture with continuity'),
      text: tt(
        'highlights_continuity_text',
        'Tripoli’s past is not behind glass: it’s heard in workshops, tasted in sweets, and seen in daily prayer, trade, and neighborhood hospitality.'
      ),
    },
  ];

  const quickFacts = [
    tt('facts_1', 'A major historic city on the eastern Mediterranean (North Lebanon)'),
    tt('facts_2', 'A dense medieval core shaped strongly in the Mamluk era'),
    tt('facts_3', 'Known for active souks, khans, hammams, and landmark mosques'),
    tt('facts_4', 'Famous across Lebanon for traditional sweets and craft heritage'),
  ];

  const timeline = [
    {
      range: tt('timeline_1_range', 'Antiquity → Early Medieval'),
      title: tt('timeline_1_title', 'Port routes and coastal city life'),
      body: tt(
        'timeline_1_body',
        'Long before modern borders, Tripoli belonged to the rhythm of the Mediterranean: trade, movement, and coastal exchange. The city’s story begins with geography — a place where routes meet.'
      ),
    },
    {
      range: tt('timeline_2_range', 'Crusader period (12th century)'),
      title: tt('timeline_2_title', 'Fortification, conflict, and changing power'),
      body: tt(
        'timeline_2_body',
        'Like many Levantine cities, Tripoli’s medieval centuries included conflict, strategic fortification, and shifting rule — a chapter that left layers of memory around the old city.'
      ),
    },
    {
      range: tt('timeline_3_range', 'Mamluk era (13th–15th centuries)'),
      title: tt('timeline_3_title', 'Urban golden age: khans, mosques, and stone craft'),
      body: tt(
        'timeline_3_body',
        'This is the era that most visibly shaped the old city. The layout of markets, major religious architecture, and civic buildings formed a dense walkable core that still holds today.'
      ),
    },
    {
      range: tt('timeline_4_range', 'Ottoman era (16th–early 20th centuries)'),
      title: tt('timeline_4_title', 'Commerce, neighborhoods, and everyday institutions'),
      body: tt(
        'timeline_4_body',
        'Trade networks and local institutions matured. The city’s “daily-life” architecture — workshops, food culture, neighborhood spaces — deepened and became tradition.'
      ),
    },
    {
      range: tt('timeline_5_range', 'Modern Lebanon (20th century → today)'),
      title: tt('timeline_5_title', 'Continuity through craft, food, and community'),
      body: tt(
        'timeline_5_body',
        'Tripoli remains a working city, not a staged set. The best way to feel it is to walk, listen, and follow the markets — where the past is carried forward by people.'
      ),
    },
  ];

  const keyMetrics = [
    { value: tt('metrics_1_value', 'Walkable core'), label: tt('metrics_1_label', 'History is experienced on foot') },
    { value: tt('metrics_2_value', 'Medieval density'), label: tt('metrics_2_label', 'Souks + khans + mosques') },
    { value: tt('metrics_3_value', 'Mamluk imprint'), label: tt('metrics_3_label', 'Key shaping era for the old city') },
    { value: tt('metrics_4_value', 'Living city'), label: tt('metrics_4_label', 'Not a museum — daily life continues') },
  ];

  return (
    <div className="seo-landing seo-landing--about">
      <div className="seo-landing__container">
        <header className="seo-landing__aboutHero" data-reveal>
          <p className="seo-landing__aboutEyebrow">{t('nav', 'megaAboutTripoli') || 'About Tripoli'}</p>
          <h1 className="seo-landing__title">{tt('title', 'The history of Tripoli, Lebanon')}</h1>
          <p className="seo-landing__intro">
            {tt(
              'intro',
              'Tripoli is one of the Levant’s great historic cities — a place where Mediterranean routes, medieval power, and craft traditions shaped a dense old city that still works today. This page is a lightweight, readable history you can scroll without heavy loading.'
            )}
          </p>
          <div className="seo-landing__aboutHeroActions" role="navigation" aria-label="Quick actions">
            <Link className="seo-landing__aboutHeroBtn" to="/discover">
              {tt('cta_explore', 'Explore places')}
            </Link>
            <Link className="seo-landing__aboutHeroBtn seo-landing__aboutHeroBtn--ghost" to="/community">
              {tt('cta_community', 'See community')}
            </Link>
          </div>
        </header>

        <section className="seo-landing__aboutLead" aria-label="Tripoli lead image and summary" data-reveal>
          <div className="seo-landing__aboutLeadMedia">
            <img
              className="seo-landing__aboutLeadImg"
              src="/tripoli-history-hero.png"
              alt={tt(
                'lead_img_alt',
                'Citadel of Raymond de Saint-Gilles, historic fortress on a green hillside above Tripoli’s old city, Lebanon.'
              )}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="seo-landing__aboutLeadBody">
            <h2 className="seo-landing__h2">{tt('lead_title', 'A city built from trade and stone')}</h2>
            <p className="seo-landing__p">
              {tt(
                'lead_text',
                'Tripoli’s old city is best understood as a system: markets connect to khans, which connect to courtyards, which connect to major landmarks. Each era added layers — but the walk remains coherent.'
              )}
            </p>
            <div className="seo-landing__aboutJump">
              <a className="seo-landing__aboutJumpLink" href="#tripoli-timeline">
                {tt('jump_timeline', 'Jump to timeline')}
              </a>
              <a className="seo-landing__aboutJumpLink" href="#tripoli-visit-notes">
                {tt('jump_notes', 'Visitor notes')}
              </a>
            </div>
          </div>
        </section>

        <section className="seo-landing__aboutMetrics" aria-label="Tripoli at a glance" data-reveal>
          {keyMetrics.map((m) => (
            <div key={m.label} className="seo-landing__aboutMetric">
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </section>

        <section className="seo-landing__aboutBand" aria-label="Tripoli overview highlights" data-reveal>
          {highlights.map((item) => (
            <article key={item.title} className="seo-landing__aboutCard">
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="seo-landing__aboutTimeline" aria-labelledby="tripoli-timeline" data-reveal>
          <h2 id="tripoli-timeline" className="seo-landing__h2">{tt('timeline_heading', 'Timeline: the eras that shaped Tripoli')}</h2>
          <p className="seo-landing__p">
            {tt('timeline_sub', 'This isn’t a textbook — it’s a scrollable story. Expand the eras you care about.')}
          </p>
          <ol className="seo-landing__timeline">
            {timeline.map((item) => (
              <li key={item.title} className="seo-landing__timelineItem">
                <details className="seo-landing__timelineDetails">
                  <summary className="seo-landing__timelineSummary">
                    <span className="seo-landing__timelineRange">{item.range}</span>
                    <span className="seo-landing__timelineTitle">{item.title}</span>
                  </summary>
                  <div className="seo-landing__timelineBody">
                    <p className="seo-landing__p">{item.body}</p>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section className="seo-landing__aboutNarrative" aria-labelledby="tripoli-visit-notes" data-reveal>
          <h2 id="tripoli-visit-notes" className="seo-landing__h2">{tt('notes_heading', 'How to feel the history (without a guide)')}</h2>
          <p className="seo-landing__p">
            {tt(
              'notes_p1',
              'Start at the Clock Tower, then follow the lanes until you hit a khan or courtyard. When you see a change in stone texture or a sudden shaded passage, slow down — that’s the city showing its age through craft.'
            )}
          </p>
          <p className="seo-landing__p">
            {tt(
              'notes_p2',
              'A good “history walk” is simple: one landmark mosque, one khan, one market loop, and one sweets stop. The rhythm is the lesson.'
            )}
          </p>
          <div className="seo-landing__aboutNext">
            <Link to="/tripoli-old-city-guide" className="seo-landing__aboutNextLink">
              {tt('link_old_city', 'Old City guide')}
            </Link>
            <Link to="/tripoli-souks-guide" className="seo-landing__aboutNextLink">
              {tt('link_souks', 'Souks guide')}
            </Link>
            <Link to="/best-sweets-in-tripoli" className="seo-landing__aboutNextLink">
              {tt('link_sweets', 'Sweets guide')}
            </Link>
          </div>
        </section>

        <section className="seo-landing__aboutFacts" aria-label="Quick facts" data-reveal>
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


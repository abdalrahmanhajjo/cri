import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getPlaceImageUrl } from '../api/client';
import DeliveryImg from '../components/DeliveryImg';
import { useLanguage } from '../context/LanguageContext';
import './SeoLanding.css';

function AboutSplitParagraphs({ text, firstClassName = 'seo-landing__p', className = 'seo-landing__p' }) {
  const parts = String(text || '')
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.map((para, i) => (
    <p key={i} className={i === 0 ? firstClassName : className}>
      {para}
    </p>
  ));
}

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

  const infoboxRows = [
    { label: tt('infobox_country_l', 'Country'), value: tt('infobox_country_v', 'Lebanon') },
    { label: tt('infobox_gov_l', 'Governorate'), value: tt('infobox_gov_v', 'North Governorate') },
    { label: tt('infobox_district_l', 'District'), value: tt('infobox_district_v', 'Tripoli District') },
    { label: tt('infobox_pop_l', 'Population (city)'), value: tt('infobox_pop_v', '~229,400') },
    { label: tt('infobox_area_l', 'Area'), value: tt('infobox_area_v', '27.39 km² (10.58 sq mi)') },
    { label: tt('infobox_demo_l', 'Demonym'), value: tt('infobox_demo_v', 'Tripolitan') },
    { label: tt('infobox_nick_l', 'Nickname'), value: tt('infobox_nick_v', 'City of Knowledge and Scholars') },
    { label: tt('infobox_coord_l', 'Coordinates'), value: tt('infobox_coord_v', '34°26′N 35°50′E') },
  ];

  const tocItems = [
    { id: 'about-overview', label: tt('toc_overview', 'Overview') },
    { id: 'about-names', label: tt('toc_names', 'Names') },
    { id: 'about-history', label: tt('toc_history', 'History') },
    { id: 'about-demographics', label: tt('toc_demographics', 'Demographics') },
    { id: 'about-geography', label: tt('toc_geography', 'Geography') },
    { id: 'about-landmarks', label: tt('toc_landmarks', 'Landmarks') },
    { id: 'about-education', label: tt('toc_education', 'Education') },
    { id: 'about-economy', label: tt('toc_economy', 'Economy') },
    { id: 'about-sister', label: tt('toc_sister', 'Twin towns') },
    { id: 'about-visit', label: tt('toc_visit', 'Visitor notes') },
  ];

  const historyBlocks = [
    { sum: tt('hist_ancient_sum', 'Ancient period'), body: tt('hist_ancient_body', '') },
    { sum: tt('hist_early_sum', 'Umayyad, Abbasid and Fatimid periods'), body: tt('hist_early_body', '') },
    { sum: tt('hist_crusader_sum', 'Crusader period'), body: tt('hist_crusader_body', '') },
    { sum: tt('hist_mamluk_sum', 'Mamluk period'), body: tt('hist_mamluk_body', '') },
    { sum: tt('hist_ottoman_sum', 'Ottoman period'), body: tt('hist_ottoman_body', '') },
    { sum: tt('hist_mandate_sum', 'French Mandate'), body: tt('hist_mandate_body', '') },
    { sum: tt('hist_modern_sum', 'Independent Lebanon'), body: tt('hist_modern_body', '') },
  ];

  const landmarkBlocks = [
    { h: tt('lm_citadel_h', 'Citadel of Tripoli'), p: tt('lm_citadel_p', '') },
    { h: tt('lm_clock_h', 'Clock Tower'), p: tt('lm_clock_p', '') },
    { h: tt('lm_hammam_h', 'Hammams'), p: tt('lm_hammam_p', '') },
    { h: tt('lm_fair_h', 'Rachid Karami International Fair'), p: tt('lm_fair_p', '') },
    { h: tt('lm_rail_h', 'Tripoli Railway Station'), p: tt('lm_rail_p', '') },
    { h: tt('lm_churches_h', 'Churches'), p: tt('lm_churches_p', '') },
    { h: tt('lm_mosques_h', 'Mosques'), p: tt('lm_mosques_p', '') },
  ];

  const quickFacts = [
    tt('facts_1', 'Northern Lebanon’s principal coastal metropolis and seaport.'),
    tt('facts_2', 'Second-highest concentration of Mamluk architecture in the region after Cairo.'),
    tt('facts_3', 'Historic Mansouri Great Mosque, citadel, clock tower, souks, khans, and hammams.'),
    tt('facts_4', 'Palm Islands Nature Reserve offshore—turtles, seals, and bird habitat.'),
    tt('facts_5', 'Hot-summer Mediterranean climate: mild wet winters, dry hot summers.'),
    tt('facts_6', 'Conurbation with El Mina—the district’s port area on the coast.'),
    tt('facts_7', 'Strong tradition of Arabic sweets, soap, and craft workshops.'),
    tt('facts_8', 'Rachid Karami International Fair: Oscar Niemeyer complex (UNESCO-listed, in danger).'),
  ];

  return (
    <div className="seo-landing seo-landing--about">
      <div className="seo-landing__container">
        <header className="seo-landing__aboutHero">
          <p className="seo-landing__aboutEyebrow">{t('nav', 'megaAboutTripoli') || 'About Tripoli'}</p>
          <h1 className="seo-landing__title">{tt('title', 'Tripoli, Lebanon')}</h1>
          <AboutSplitParagraphs
            text={tt(
              'intro',
              'Tripoli is the largest city in northern Lebanon and the country’s second-largest urban centre. It lies on the east Mediterranean, about 81 km north of Beirut, and serves as capital of both the North Governorate and Tripoli District.'
            )}
            firstClassName="seo-landing__intro"
            className="seo-landing__intro"
          />
          <div className="seo-landing__aboutHeroActions" role="navigation" aria-label="Quick actions">
            <Link className="seo-landing__aboutHeroBtn" to="/discover">
              {tt('cta_explore', 'Explore places')}
            </Link>
            <Link className="seo-landing__aboutHeroBtn seo-landing__aboutHeroBtn--ghost" to="/community">
              {tt('cta_community', 'See community')}
            </Link>
          </div>
        </header>

        <div className="seo-landing__aboutWikiLayout">
          <div className="seo-landing__aboutWikiMain">
            <nav className="seo-landing__aboutToc" aria-label={tt('toc_title', 'Contents')}>
              <h2 className="seo-landing__aboutTocTitle">{tt('toc_title', 'Contents')}</h2>
              <ol className="seo-landing__aboutTocList">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.label}</a>
                  </li>
                ))}
              </ol>
            </nav>

            <section id="about-overview" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_overview_h', 'Overview')}</h2>
              <div className="seo-landing__aboutLead seo-landing__aboutLead--inWiki">
                <figure className="seo-landing__aboutLeadMedia">
                  <img
                    className="seo-landing__aboutLeadImg"
                    src="/tripoli-history-hero.png"
                    alt={tt(
                      'lead_img_alt',
                      'Citadel above Tripoli’s old city, Lebanon.'
                    )}
                    width={1200}
                    height={630}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </figure>
                <div className="seo-landing__aboutLeadBody">
                  <AboutSplitParagraphs
                    text={tt(
                      'lead_text',
                      'The old city preserves one of the densest concentrations of Mamluk architecture in the region after Cairo. Landmarks include the Mansouri Great Mosque and the Citadel of Tripoli—the largest Crusader-era castle in Lebanon. Offshore lie the Palm Islands reserve, important for sea turtles, seals, and migratory birds.'
                    )}
                    firstClassName="seo-landing__p"
                    className="seo-landing__p"
                  />
                </div>
              </div>
            </section>

            <section id="about-names" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_names_h', 'Names')}</h2>
              <AboutSplitParagraphs text={tt('sec_names_p', '')} />
            </section>

            <section id="about-history" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_history_h', 'History')}</h2>
              <p className="seo-landing__p">{tt('sec_history_sub', 'Expand a period for a short summary.')}</p>
              <div className="seo-landing__aboutHistory">
                {historyBlocks.map((blk) => (
                  <details key={blk.sum} className="seo-landing__aboutHistoryDetails">
                    <summary className="seo-landing__aboutHistorySummary">{blk.sum}</summary>
                    <div className="seo-landing__aboutHistoryBody">
                      <AboutSplitParagraphs text={blk.body} />
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section id="about-demographics" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_demo_h', 'Demographics')}</h2>
              <AboutSplitParagraphs text={tt('sec_demo_p', '')} />
            </section>

            <section id="about-geography" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_geo_h', 'Geography')}</h2>
              <h3 className="seo-landing__aboutSectionH3">{tt('sec_geo_climate_h', 'Climate')}</h3>
              <AboutSplitParagraphs text={tt('sec_geo_climate_p', '')} />
              <h3 className="seo-landing__aboutSectionH3">{tt('sec_geo_islands_h', 'Offshore islands')}</h3>
              <AboutSplitParagraphs text={tt('sec_geo_islands_p', '')} />
            </section>

            <section id="about-landmarks" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_landmarks_h', 'Landmarks')}</h2>
              {landmarkBlocks.map((lm) => (
                <div key={lm.h} className="seo-landing__aboutLandmark">
                  <h3 className="seo-landing__aboutSectionH3">{lm.h}</h3>
                  <AboutSplitParagraphs text={lm.p} />
                </div>
              ))}
            </section>

            <section id="about-education" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_edu_h', 'Education')}</h2>
              <AboutSplitParagraphs text={tt('sec_edu_p', '')} />
            </section>

            <section id="about-economy" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_econ_h', 'Economy')}</h2>
              <AboutSplitParagraphs text={tt('sec_econ_p', '')} />
            </section>

            <section id="about-sister" className="seo-landing__aboutSection">
              <h2 className="seo-landing__aboutSectionH">{tt('sec_sister_h', 'International relations')}</h2>
              <AboutSplitParagraphs text={tt('sec_sister_p', '')} />
            </section>

            <section id="about-visit" className="seo-landing__aboutSection seo-landing__aboutSection--visit">
              <h2 className="seo-landing__aboutSectionH">{tt('notes_heading', 'Visitor notes')}</h2>
              <AboutSplitParagraphs
                text={tt(
                  'notes_p1',
                  'Dress modestly at religious sites; ask before photographing people. The Old City is easiest on foot—pick a landmark such as the clock tower and explore in loops.'
                )}
              />
              <AboutSplitParagraphs
                text={tt(
                  'notes_p2',
                  'Allow time for a congregational mosque facade, a khan courtyard, a souk passage, and a sweets stop—the sequence mirrors how the historic city was meant to be used.'
                )}
              />
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

            <section className="seo-landing__aboutFacts" aria-label={tt('facts_heading', 'Quick facts')} data-reveal>
              <h2 className="seo-landing__h2">{tt('facts_heading', 'Quick facts')}</h2>
              <ul className="seo-landing__aboutList">
                {quickFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="seo-landing__aboutWikiAside" aria-label={tt('infobox_title', 'City profile')}>
            <div className="seo-landing__aboutInfobox">
              <h2 className="seo-landing__aboutInfoboxTitle">{tt('infobox_title', 'City profile')}</h2>
              <table className="seo-landing__aboutInfoboxTable">
                <tbody>
                  {infoboxRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{tt('infobox_web_l', 'Website')}</th>
                    <td>
                      <a
                        className="seo-landing__aboutInfoboxLink"
                        href="https://tripoli.gov.lb/"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        tripoli.gov.lb
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}


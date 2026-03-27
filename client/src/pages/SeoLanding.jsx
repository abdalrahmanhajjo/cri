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
  const [vibe, setVibe] = useState('heritage');
  const [quizStep, setQuizStep] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState(() => ({ pace: null, focus: null, time: null }));
  const [checklist, setChecklist] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('aboutTripoliChecklistV1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !checklist) return;
    try {
      window.localStorage.setItem('aboutTripoliChecklistV1', JSON.stringify(checklist));
    } catch {
      // ignore
    }
  }, [checklist]);

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

  const vibeCards = [
    {
      id: 'heritage',
      title: 'Heritage walk',
      kicker: 'Stone, shade, courtyards',
      bullets: ['Clock Tower → old city alleys', 'One landmark mosque', 'Craft stops: soap + copper'],
    },
    {
      id: 'food',
      title: 'Sweets & bites',
      kicker: 'Crisp, syrup, coffee',
      bullets: ['Sweets tasting (Hallab or your pick)', 'Spice market aromas', 'Small bakery detour'],
    },
    {
      id: 'markets',
      title: 'Souks deep-dive',
      kicker: 'Traders, tools, stories',
      bullets: ['Follow the covered lanes', 'Ask one shopkeeper for a “loop”', 'Buy one tiny thing as a souvenir'],
    },
    {
      id: 'coast',
      title: 'Coast & calm',
      kicker: 'Sea air, soft hours',
      bullets: ['Start early for light', 'Pair the core with a coastal pause', 'Finish with sunset colors'],
    },
  ];

  const quiz = [
    {
      id: 'pace',
      q: 'Your ideal pace?',
      a: [
        { id: 'slow', label: 'Slow & curious' },
        { id: 'balanced', label: 'Balanced' },
        { id: 'fast', label: 'Fast highlights' },
      ],
    },
    {
      id: 'focus',
      q: 'What pulls you in?',
      a: [
        { id: 'architecture', label: 'Architecture' },
        { id: 'food', label: 'Food' },
        { id: 'markets', label: 'Markets' },
      ],
    },
    {
      id: 'time',
      q: 'How much time today?',
      a: [
        { id: '2h', label: '2 hours' },
        { id: 'half', label: 'Half-day' },
        { id: 'full', label: 'Full day' },
      ],
    },
  ];

  const quizPick = (step, answerId) => {
    const k = quiz[step]?.id;
    if (!k) return;
    setQuizAnswers((prev) => ({ ...prev, [k]: answerId }));
    if (step >= quiz.length - 1) {
      setQuizDone(true);
      return;
    }
    setQuizStep(step + 1);
  };

  const quizSummary = useMemo(() => {
    if (!quizDone) return null;
    const pace = quizAnswers.pace;
    const focus = quizAnswers.focus;
    const time = quizAnswers.time;
    const vibeHint = focus === 'food' ? 'food' : focus === 'markets' ? 'markets' : 'heritage';
    const duration = time === '2h' ? 'a sharp 2‑hour loop' : time === 'half' ? 'a half‑day story‑walk' : 'a full‑day deep dive';
    const tempo = pace === 'slow' ? 'slow, with pauses for details' : pace === 'fast' ? 'fast, with just the icons' : 'balanced, with one surprise stop';
    const next = vibeCards.find((c) => c.id === vibeHint) || vibeCards[0];
    return {
      title: `Your Tripoli plan: ${duration}`,
      subtitle: `Keep it ${tempo}.`,
      suggestId: next.id,
    };
  }, [quizDone, quizAnswers]);

  const defaultChecklist = useMemo(
    () => ({
      comfyShoes: false,
      modestWear: false,
      smallCash: false,
      water: false,
      askPermission: false,
      sweetsBox: false,
    }),
    []
  );
  const effectiveChecklist = checklist || defaultChecklist;
  const checkedCount = Object.values(effectiveChecklist).filter(Boolean).length;
  const setCheck = (key, val) => {
    setChecklist((prev) => ({ ...(prev || defaultChecklist), [key]: Boolean(val) }));
  };

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
      <div className="seo-landing__container">
        <header className="seo-landing__aboutHero" data-reveal>
          <p className="seo-landing__aboutEyebrow">{t('nav', 'megaAboutTripoli') || 'About Tripoli'}</p>
          <h1 className="seo-landing__title">About Tripoli, Lebanon</h1>
          <p className="seo-landing__intro">
            Tripoli is a Mediterranean city of memory and movement. Its old streets carry deep history, while its
            souks, workshops, and neighborhoods keep the city present-tense and alive. This overview introduces the
            spirit, heritage, and visitor value of Tripoli in one page.
          </p>
          <div className="seo-landing__aboutHeroActions" role="navigation" aria-label="Quick actions">
            <Link className="seo-landing__aboutHeroBtn" to="/discover">Explore places</Link>
            <Link className="seo-landing__aboutHeroBtn seo-landing__aboutHeroBtn--ghost" to="/community">See community</Link>
          </div>
        </header>

        <section className="seo-landing__aboutVisualGrid" aria-label="Tripoli visual overview" data-reveal>
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

        <section className="seo-landing__aboutPlay" aria-label="Interactive activities" data-reveal>
          <div className="seo-landing__aboutPlayHead">
            <h2 className="seo-landing__h2">Make it your Tripoli</h2>
            <p className="seo-landing__p">
              Pick a vibe, answer a 2‑minute quiz, and save a tiny checklist. These small choices keep the day smooth.
            </p>
          </div>

          <div className="seo-landing__aboutPlayGrid">
            <div className="seo-landing__aboutPlayCard">
              <div className="seo-landing__aboutPlayTop">
                <h3>Choose your vibe</h3>
                <p>Tap a card. We’ll keep it as your suggested flow.</p>
              </div>
              <div className="seo-landing__aboutVibeRow" role="tablist" aria-label="Tripoli vibes">
                {vibeCards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`seo-landing__aboutVibe ${vibe === c.id ? 'is-active' : ''}`}
                    onClick={() => setVibe(c.id)}
                    role="tab"
                    aria-selected={vibe === c.id}
                  >
                    <span className="seo-landing__aboutVibeKicker">{c.kicker}</span>
                    <span className="seo-landing__aboutVibeTitle">{c.title}</span>
                  </button>
                ))}
              </div>
              <div className="seo-landing__aboutVibeBody" role="tabpanel">
                {(() => {
                  const picked = vibeCards.find((c) => c.id === vibe) || vibeCards[0];
                  return (
                    <ul className="seo-landing__aboutVibeBullets">
                      {picked.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  );
                })()}
                <div className="seo-landing__aboutMiniCtas">
                  <Link to="/plan" className="seo-landing__aboutMiniBtn">Build a plan</Link>
                  <Link to="/discover" className="seo-landing__aboutMiniBtn seo-landing__aboutMiniBtn--ghost">Browse places</Link>
                </div>
              </div>
            </div>

            <div className="seo-landing__aboutPlayCard">
              <div className="seo-landing__aboutPlayTop">
                <h3>2‑minute quiz</h3>
                <p>Answer 3 quick questions and get a suggested loop.</p>
              </div>
              {!quizDone ? (
                <div className="seo-landing__aboutQuiz">
                  <div className="seo-landing__aboutQuizMeta" aria-label="Quiz progress">
                    <span>Step {quizStep + 1} / {quiz.length}</span>
                    <span className="seo-landing__aboutQuizBar" aria-hidden>
                      <span style={{ width: `${Math.round(((quizStep + 1) / quiz.length) * 100)}%` }} />
                    </span>
                  </div>
                  <h4 className="seo-landing__aboutQuizQ">{quiz[quizStep].q}</h4>
                  <div className="seo-landing__aboutQuizA">
                    {quiz[quizStep].a.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="seo-landing__aboutQuizBtn"
                        onClick={() => quizPick(quizStep, a.id)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  {quizStep > 0 && (
                    <button type="button" className="seo-landing__aboutQuizBack" onClick={() => setQuizStep((s) => Math.max(0, s - 1))}>
                      Back
                    </button>
                  )}
                </div>
              ) : (
                <div className="seo-landing__aboutQuizDone">
                  <h4 className="seo-landing__aboutQuizQ">{quizSummary?.title || 'Your Tripoli plan'}</h4>
                  <p>{quizSummary?.subtitle || 'A clean loop with time for one surprise stop.'}</p>
                  <div className="seo-landing__aboutMiniCtas">
                    <button
                      type="button"
                      className="seo-landing__aboutMiniBtn"
                      onClick={() => {
                        const suggested = quizSummary?.suggestId;
                        if (suggested) setVibe(suggested);
                        setQuizDone(false);
                        setQuizStep(0);
                        setQuizAnswers({ pace: null, focus: null, time: null });
                      }}
                    >
                      Retake
                    </button>
                    <Link to="/plan" className="seo-landing__aboutMiniBtn seo-landing__aboutMiniBtn--ghost">Go to planner</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="seo-landing__aboutPlayCard seo-landing__aboutPlayCard--wide">
              <div className="seo-landing__aboutPlayTop">
                <h3>Saveable checklist</h3>
                <p>Small things that make the old city feel effortless. Saved on this device.</p>
              </div>
              <div className="seo-landing__aboutChecklist">
                <div className="seo-landing__aboutChecklistMeta">
                  <span>{checkedCount} / {Object.keys(effectiveChecklist).length} done</span>
                  <button type="button" className="seo-landing__aboutChecklistReset" onClick={() => setChecklist(defaultChecklist)}>
                    Reset
                  </button>
                </div>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.comfyShoes)} onChange={(e) => setCheck('comfyShoes', e.target.checked)} />
                  <span>Comfortable shoes</span>
                </label>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.modestWear)} onChange={(e) => setCheck('modestWear', e.target.checked)} />
                  <span>Modest layers for sacred sites</span>
                </label>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.smallCash)} onChange={(e) => setCheck('smallCash', e.target.checked)} />
                  <span>Small cash for markets</span>
                </label>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.water)} onChange={(e) => setCheck('water', e.target.checked)} />
                  <span>Water bottle</span>
                </label>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.askPermission)} onChange={(e) => setCheck('askPermission', e.target.checked)} />
                  <span>Ask before photographing people</span>
                </label>
                <label className="seo-landing__aboutCheck">
                  <input type="checkbox" checked={Boolean(effectiveChecklist.sweetsBox)} onChange={(e) => setCheck('sweetsBox', e.target.checked)} />
                  <span>Leave space for sweets</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="seo-landing__aboutNarrative" aria-labelledby="tripoli-overview-story" data-reveal>
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


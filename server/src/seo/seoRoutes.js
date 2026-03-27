const express = require('express');
const { query } = require('../db');
const { getRequestLang } = require('../utils/requestLang');
const {
  clampText,
  getBaseUrl,
  safeUrlJoin,
  resolveOgImage,
  loadClientIndexHtml,
  injectSeoIntoIndexHtml,
} = require('./seoUtils');

const router = express.Router();

const LANGS = ['en', 'ar', 'fr'];

function wantsHtml(req) {
  const accept = String(req.get('accept') || '');
  return accept.includes('text/html') || accept.includes('*/*');
}

function normalizeSlugSegment(seg) {
  return String(seg || '').trim().toLowerCase();
}

function buildAlternates(baseUrl, pathname) {
  const pathOnly = String(pathname || '').startsWith('/') ? String(pathname) : `/${pathname || ''}`;
  const out = LANGS.map((code) => ({
    hreflang: code,
    href: `${safeUrlJoin(baseUrl, pathOnly)}?lang=${code}`,
  }));
  // x-default should usually point to English.
  out.push({ hreflang: 'x-default', href: `${safeUrlJoin(baseUrl, pathOnly)}?lang=en` });
  return out;
}

function pickFirstImage(imagesJson) {
  try {
    const arr = Array.isArray(imagesJson) ? imagesJson : typeof imagesJson === 'string' ? JSON.parse(imagesJson) : [];
    const u = arr.find((x) => typeof x === 'string' && x.trim());
    return u ? String(u).trim() : null;
  } catch {
    return null;
  }
}

function organizationIdForBase(baseUrl) {
  return `${String(baseUrl || '').replace(/\/$/, '')}#organization`;
}

function websiteIdForBase(baseUrl) {
  return `${String(baseUrl || '').replace(/\/$/, '')}#website`;
}

function organizationSameAsFromEnv() {
  const raw = (process.env.ORGANIZATION_SAME_AS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((u) => u.startsWith('http://') || u.startsWith('https://'));
}

function jsonLdOrg({ baseUrl }) {
  const logoUrl = safeUrlJoin(baseUrl, '/tripoli-lebanon-icon.svg');
  const sameAs = organizationSameAsFromEnv();
  const out = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationIdForBase(baseUrl),
    name: 'Visit Tripoli',
    url: baseUrl,
    logo: logoUrl,
  };
  if (sameAs.length > 0) out.sameAs = sameAs;
  return out;
}

function jsonLdBreadcrumb({ baseUrl, items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: (items || []).map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.path ? safeUrlJoin(baseUrl, it.path) : undefined,
    })),
  };
}

function jsonLdWebsite({ baseUrl }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteIdForBase(baseUrl),
    name: 'Visit Tripoli',
    url: baseUrl,
    inLanguage: ['en', 'ar', 'fr'],
    publisher: { '@id': organizationIdForBase(baseUrl) },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/discover?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function jsonLdPlace({ baseUrl, place, canonical, image }) {
  const name = place?.name || 'Place in Tripoli';
  const desc = clampText(place?.description || '', 300);
  const loc = place?.location ? String(place.location) : 'Tripoli, Lebanon';
  const out = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name,
    url: canonical,
    description: desc || undefined,
    image: image || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: loc,
      addressCountry: 'LB',
    },
  };
  // Coordinates are optional but helpful.
  if (place?.latitude != null && place?.longitude != null) {
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
    }
  }
  return JSON.stringify(out);
}

function jsonLdEvent({ canonical, event, image }) {
  const out = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event?.name || 'Event in Tripoli',
    url: canonical,
    description: clampText(event?.description || '', 300) || undefined,
    image: image || undefined,
    startDate: event?.startDate || undefined,
    endDate: event?.endDate || undefined,
    eventStatus: event?.status ? `https://schema.org/${String(event.status)}` : undefined,
    location: {
      '@type': 'Place',
      name: event?.location || 'Tripoli, Lebanon',
    },
  };
  return JSON.stringify(out);
}

function jsonLdTour({ canonical, tour, image }) {
  const out = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: tour?.name || 'Tour in Tripoli',
    url: canonical,
    description: clampText(tour?.description || '', 300) || undefined,
    image: image || undefined,
  };
  return JSON.stringify(out);
}

// --- robots.txt ---
router.get('/robots.txt', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

// --- sitemap.xml (cached) ---
let sitemapCache = { xml: null, ts: 0 };
const SITEMAP_TTL_MS = 10 * 60 * 1000;

router.get('/sitemap.xml', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const now = Date.now();
    if (sitemapCache.xml && now - sitemapCache.ts < SITEMAP_TTL_MS) {
      return res.type('application/xml').send(sitemapCache.xml.replace(/__BASE__/g, baseUrl));
    }

    const urls = new Set();
    const add = (p) => urls.add(safeUrlJoin('__BASE__', p)); // placeholder replaced on send

    // Core pages
    add('/');
    add('/discover');
    add('/activities');

    // SEO landing pages
    add('/things-to-do-in-tripoli-lebanon');
    add('/tripoli-old-city-guide');
    add('/tripoli-souks-guide');
    add('/best-sweets-in-tripoli');
    add('/tripoli-travel-tips');
    add('/about-tripoli');
    add('/partner-link-kit');

    // Dynamic pages from DB
    try {
      const [places, tours, events] = await Promise.all([
        query('SELECT id FROM places ORDER BY id ASC'),
        query('SELECT id FROM tours ORDER BY id ASC'),
        query('SELECT id FROM events ORDER BY id ASC'),
      ]);
      for (const r of places.rows || []) add(`/place/${encodeURIComponent(normalizeSlugSegment(String(r.id)))}`);
      for (const r of tours.rows || []) add(`/tour/${encodeURIComponent(normalizeSlugSegment(String(r.id)))}`);
      for (const r of events.rows || []) add(`/event/${encodeURIComponent(String(r.id))}`);
    } catch {
      // If DB is temporarily unavailable, still serve the static sitemap.
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      Array.from(urls)
        .map((loc) => `  <url><loc>${loc}</loc></url>`)
        .join('\n') +
      `\n</urlset>\n`;

    sitemapCache = { xml, ts: now };
    return res.type('application/xml').send(xml.replace(/__BASE__/g, baseUrl));
  } catch {
    // Absolute fallback: never 500.
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${safeUrlJoin(baseUrl, '/')}</loc></url>\n` +
      `  <url><loc>${safeUrlJoin(baseUrl, '/discover')}</loc></url>\n` +
      `  <url><loc>${safeUrlJoin(baseUrl, '/activities')}</loc></url>\n` +
      `</urlset>\n`;
    return res.type('application/xml').send(xml);
  }
});

// --- SEO HTML for key public routes ---
function makeSeoResponder({ clientDistPath }) {
  return async function seoResponder(req, res, next) {
    try {
      if (!wantsHtml(req)) return next();
      const baseUrl = getBaseUrl(req);
      const lang = getRequestLang(req);
      const p = req.path;

      const indexHtml = loadClientIndexHtml(clientDistPath);

      // Defaults
      let title = 'Visit Tripoli – Places, experiences & events';
      let description =
        'Discover Tripoli, Lebanon — places, experiences, tours, and events. Build your plan and explore the city.';
      let canonical = safeUrlJoin(baseUrl, req.originalUrl.split('?')[0]);
      let ogImage = safeUrlJoin(baseUrl, '/tripoli-hero-bg.png');
      let robots = 'index,follow';
      let alternates = buildAlternates(baseUrl, req.path);
      let jsonLd = JSON.stringify([jsonLdOrg({ baseUrl }), jsonLdWebsite({ baseUrl })]);
      let status = 200;

      if (p === '/' || p === '/discover' || p === '/activities') {
        if (p === '/discover') {
          title = 'Discover Tripoli – Places directory | Visit Tripoli';
          description = 'Browse places in Tripoli, Lebanon. Search by name and explore venues with photos and details.';
          canonical = safeUrlJoin(baseUrl, '/discover');
          alternates = buildAlternates(baseUrl, '/discover');
        } else if (p === '/activities') {
          title = 'Activities & events in Tripoli | Visit Tripoli';
          description = 'Find experiences, activities, and upcoming events in Tripoli, Lebanon.';
          canonical = safeUrlJoin(baseUrl, '/activities');
          alternates = buildAlternates(baseUrl, '/activities');
        } else {
          canonical = safeUrlJoin(baseUrl, '/');
          alternates = buildAlternates(baseUrl, '/');
        }
      } else if (p.startsWith('/place/')) {
        const raw = decodeURIComponent(p.slice('/place/'.length));
        const id = normalizeSlugSegment(raw);
        const { rows } = await query(
          `SELECT p.id, p.latitude, p.longitude, p.images,
                  p.search_name,
                  COALESCE(pt.name, p.name) AS name,
                  COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $2
           WHERE LOWER(p.id::text) = $1 OR LOWER(COALESCE(p.search_name, '')) = $1
           LIMIT 1`,
          [String(id), lang]
        );
        const place = rows && rows[0];
        if (!place) {
          status = 404;
          robots = 'noindex,follow';
          title = 'Place not found | Visit Tripoli';
          description = 'This place could not be found.';
          jsonLd = '';
          ogImage = safeUrlJoin(baseUrl, '/tripoli-hero-bg.png');
        } else {
          const canonicalId = normalizeSlugSegment(String(place.search_name || place.id));
          title = `${place.name} | Visit Tripoli`;
          description = place.description || `Explore ${place.name} in Tripoli, Lebanon.`;
          canonical = safeUrlJoin(baseUrl, `/place/${encodeURIComponent(canonicalId)}`);
          alternates = buildAlternates(baseUrl, `/place/${encodeURIComponent(canonicalId)}`);
          const img = pickFirstImage(place.images);
          ogImage = resolveOgImage(baseUrl, img) || ogImage;
          const crumbs = jsonLdBreadcrumb({
            baseUrl,
            items: [
              { name: 'Home', path: '/' },
              { name: 'Discover', path: '/discover' },
              { name: place.name, path: `/place/${encodeURIComponent(canonicalId)}` },
            ],
          });
          jsonLd = JSON.stringify([
            JSON.parse(jsonLdPlace({ baseUrl, place, canonical, image: ogImage })),
            crumbs,
            jsonLdOrg({ baseUrl }),
          ]);
        }
      } else if (p.startsWith('/tour/')) {
        const raw = decodeURIComponent(p.slice('/tour/'.length));
        const id = normalizeSlugSegment(raw);
        const { rows } = await query(
          `SELECT t.id, t.image,
                  COALESCE(t.id::text, '') AS slug,
                  COALESCE(tt.name, t.name) AS name,
                  COALESCE(tt.description, t.description) AS description
           FROM tours t
           LEFT JOIN tour_translations tt ON tt.tour_id = t.id AND tt.lang = $2
           WHERE LOWER(t.id::text) = $1
           LIMIT 1`,
          [String(id), lang]
        );
        const tour = rows && rows[0];
        if (!tour) {
          status = 404;
          robots = 'noindex,follow';
          title = 'Tour not found | Visit Tripoli';
          description = 'This tour could not be found.';
          jsonLd = '';
        } else {
          const canonicalId = normalizeSlugSegment(String(tour.id));
          title = `${tour.name} | Tours in Tripoli`;
          description = tour.description || `Tour: ${tour.name}`;
          canonical = safeUrlJoin(baseUrl, `/tour/${encodeURIComponent(canonicalId)}`);
          alternates = buildAlternates(baseUrl, `/tour/${encodeURIComponent(canonicalId)}`);
          ogImage = resolveOgImage(baseUrl, tour.image) || ogImage;
          const crumbs = jsonLdBreadcrumb({
            baseUrl,
            items: [
              { name: 'Home', path: '/' },
              { name: 'Activities', path: '/activities' },
              { name: tour.name, path: `/tour/${encodeURIComponent(canonicalId)}` },
            ],
          });
          jsonLd = JSON.stringify([
            JSON.parse(jsonLdTour({ canonical, tour, image: ogImage })),
            crumbs,
            jsonLdOrg({ baseUrl }),
          ]);
        }
      } else if (p.startsWith('/event/')) {
        const id = decodeURIComponent(p.slice('/event/'.length));
        const { rows } = await query(
          `SELECT e.id, e.start_date, e.end_date, e.image,
                  COALESCE(et.name, e.name) AS name,
                  COALESCE(et.description, e.description) AS description,
                  COALESCE(et.location, e.location) AS location,
                  COALESCE(et.status, e.status) AS status
           FROM events e
           LEFT JOIN event_translations et ON et.event_id = e.id AND et.lang = $2
           WHERE e.id::text = $1
           LIMIT 1`,
          [String(id), lang]
        );
        const row = rows && rows[0];
        if (!row) {
          status = 404;
          robots = 'noindex,follow';
          title = 'Event not found | Visit Tripoli';
          description = 'This event could not be found.';
          jsonLd = '';
        } else {
          const event = {
            id: row.id,
            name: row.name,
            description: row.description,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString() : row.end_date,
            location: row.location,
            status: row.status,
          };
          title = `${event.name} | Events in Tripoli`;
          description = event.description || `Event: ${event.name}`;
          canonical = safeUrlJoin(baseUrl, `/event/${encodeURIComponent(String(event.id))}`);
          alternates = buildAlternates(baseUrl, `/event/${encodeURIComponent(String(event.id))}`);
          ogImage = resolveOgImage(baseUrl, row.image) || ogImage;
          const crumbs = jsonLdBreadcrumb({
            baseUrl,
            items: [
              { name: 'Home', path: '/' },
              { name: 'Activities', path: '/activities' },
              { name: event.name, path: `/event/${encodeURIComponent(String(event.id))}` },
            ],
          });
          jsonLd = JSON.stringify([
            JSON.parse(jsonLdEvent({ canonical, event, image: ogImage })),
            crumbs,
            jsonLdOrg({ baseUrl }),
          ]);
        }
      } else if (
        p === '/things-to-do-in-tripoli-lebanon' ||
        p === '/tripoli-old-city-guide' ||
        p === '/tripoli-souks-guide' ||
        p === '/best-sweets-in-tripoli' ||
        p === '/tripoli-travel-tips' ||
        p === '/about-tripoli' ||
        p === '/partner-link-kit'
      ) {
        const metaByPath = {
          '/things-to-do-in-tripoli-lebanon': {
            title: 'Things to do in Tripoli, Lebanon | Visit Tripoli',
            description:
              'Best things to do in Tripoli, Lebanon: explore the old city souks, visit historic mosques, and taste the city’s famous sweets. A simple guide for first-time visitors.',
          },
          '/tripoli-old-city-guide': {
            title: 'Tripoli Old City guide (Lebanon) | Visit Tripoli',
            description:
              'A walking guide to Tripoli’s old city: where to start, what to see in the souks and khans, and practical tips for a smooth visit in Tripoli, Lebanon.',
          },
          '/tripoli-souks-guide': {
            title: 'Tripoli Souks guide: markets, spices & crafts | Visit Tripoli',
            description:
              'Explore Tripoli’s souks in Lebanon: spice markets, soap khans, crafts, and what to buy. A practical guide to the old city markets.',
          },
          '/best-sweets-in-tripoli': {
            title: 'Best sweets in Tripoli, Lebanon | Visit Tripoli',
            description:
              'Tripoli is the sweets capital of Lebanon. Learn what to try, where to go, and how to plan a tasting walk with markets and landmarks.',
          },
          '/tripoli-travel-tips': {
            title: 'Tripoli, Lebanon travel tips | Visit Tripoli',
            description:
              'Tripoli travel tips: best time to visit, how to get around the old city, what to wear, and respectful visiting advice for a comfortable day in Tripoli, Lebanon.',
          },
          '/about-tripoli': {
            title: 'History of Tripoli, Lebanon | Visit Tripoli',
            description:
              'Timeline of Tripoli, Lebanon: Mediterranean trade, medieval fortifications, Mamluk old city, Ottoman markets, and today’s living souks. Lightweight guide for visitors.',
            ogImagePath: '/tripoli-history-hero.png',
          },
          '/partner-link-kit': {
            title: 'Partner Link Kit for Visit Tripoli | Official Backlinks',
            description:
              'Official Visit Tripoli backlink kit with exact target URLs and anchor texts for municipality, university, venue, and event websites.',
          },
        };
        const info = metaByPath[p];
        title = info.title;
        description = info.description;
        if (info.ogImagePath) ogImage = safeUrlJoin(baseUrl, info.ogImagePath);
        canonical = safeUrlJoin(baseUrl, p);
        alternates = buildAlternates(baseUrl, p);
        const crumbs = jsonLdBreadcrumb({
          baseUrl,
          items: [
            { name: 'Home', path: '/' },
            { name: info.title.replace(/\s*\|\s*Visit Tripoli$/, ''), path: p },
          ],
        });
        const webPage = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: info.title,
          url: canonical,
          description: clampText(description, 300) || undefined,
          isPartOf: { '@id': websiteIdForBase(baseUrl) },
        };
        jsonLd = JSON.stringify([webPage, crumbs, jsonLdOrg({ baseUrl }), jsonLdWebsite({ baseUrl })]);
      } else {
        return next();
      }

      const out = injectSeoIntoIndexHtml(indexHtml, {
        title,
        description,
        canonical,
        ogImage,
        robots,
        lang,
        jsonLd,
        alternates,
      });
      res.status(status).type('text/html').send(out);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { seoRouter: router, makeSeoResponder };


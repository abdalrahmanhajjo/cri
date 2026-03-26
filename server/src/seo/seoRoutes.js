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

function wantsHtml(req) {
  const accept = String(req.get('accept') || '');
  return accept.includes('text/html') || accept.includes('*/*');
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

function jsonLdWebsite({ baseUrl }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Visit Tripoli',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/discover?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });
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

  // Dynamic pages from DB
  try {
    const [places, tours, events] = await Promise.all([
      query('SELECT id FROM places ORDER BY id ASC'),
      query('SELECT id FROM tours ORDER BY id ASC'),
      query('SELECT id FROM events ORDER BY id ASC'),
    ]);
    for (const r of places.rows || []) add(`/place/${encodeURIComponent(String(r.id))}`);
    for (const r of tours.rows || []) add(`/tour/${encodeURIComponent(String(r.id))}`);
    for (const r of events.rows || []) add(`/event/${encodeURIComponent(String(r.id))}`);
  } catch {
    // If DB is temporarily unavailable, still serve the core sitemap.
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
      let jsonLd = jsonLdWebsite({ baseUrl });
      let status = 200;

      if (p === '/' || p === '/discover' || p === '/activities') {
        if (p === '/discover') {
          title = 'Discover Tripoli – Places directory | Visit Tripoli';
          description = 'Browse places in Tripoli, Lebanon. Search by name and explore venues with photos and details.';
          canonical = safeUrlJoin(baseUrl, '/discover');
        } else if (p === '/activities') {
          title = 'Activities & events in Tripoli | Visit Tripoli';
          description = 'Find experiences, activities, and upcoming events in Tripoli, Lebanon.';
          canonical = safeUrlJoin(baseUrl, '/activities');
        } else {
          canonical = safeUrlJoin(baseUrl, '/');
        }
      } else if (p.startsWith('/place/')) {
        const id = decodeURIComponent(p.slice('/place/'.length));
        const { rows } = await query(
          `SELECT p.id, p.latitude, p.longitude, p.images,
                  COALESCE(pt.name, p.name) AS name,
                  COALESCE(pt.description, p.description) AS description,
                  COALESCE(pt.location, p.location) AS location
           FROM places p
           LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.lang = $2
           WHERE p.id::text = $1
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
          title = `${place.name} | Visit Tripoli`;
          description = place.description || `Explore ${place.name} in Tripoli, Lebanon.`;
          canonical = safeUrlJoin(baseUrl, `/place/${encodeURIComponent(String(place.id))}`);
          const img = pickFirstImage(place.images);
          ogImage = resolveOgImage(baseUrl, img) || ogImage;
          jsonLd = jsonLdPlace({ baseUrl, place, canonical, image: ogImage });
        }
      } else if (p.startsWith('/tour/')) {
        const id = decodeURIComponent(p.slice('/tour/'.length));
        const { rows } = await query(
          `SELECT t.id, t.image,
                  COALESCE(tt.name, t.name) AS name,
                  COALESCE(tt.description, t.description) AS description
           FROM tours t
           LEFT JOIN tour_translations tt ON tt.tour_id = t.id AND tt.lang = $2
           WHERE t.id::text = $1
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
          title = `${tour.name} | Tours in Tripoli`;
          description = tour.description || `Tour: ${tour.name}`;
          canonical = safeUrlJoin(baseUrl, `/tour/${encodeURIComponent(String(tour.id))}`);
          ogImage = resolveOgImage(baseUrl, tour.image) || ogImage;
          jsonLd = jsonLdTour({ canonical, tour, image: ogImage });
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
          ogImage = resolveOgImage(baseUrl, row.image) || ogImage;
          jsonLd = jsonLdEvent({ canonical, event, image: ogImage });
        }
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
      });
      res.status(status).type('text/html').send(out);
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { seoRouter: router, makeSeoResponder };


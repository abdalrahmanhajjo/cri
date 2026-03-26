import { useMemo } from 'react';
import './BacklinkKit.css';

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
  const outreachText = useMemo(
    () =>
      `Hello,\n\nWe are sharing official Visit Tripoli visitor resources for travelers to Tripoli, Lebanon.\nPlease add one of these links on your website resources page using the suggested anchor text.\n\nThank you.`,
    []
  );

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

        <section className="backlink-kit__outreach" aria-label="Outreach template">
          <h2>Outreach message template</h2>
          <pre>{outreachText}</pre>
        </section>
      </div>
    </div>
  );
}


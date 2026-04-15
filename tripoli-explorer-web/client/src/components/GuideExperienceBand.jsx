import Icon from './Icon';
import './GuideExperienceBand.css';

const CONFIG = {
  diningGuide: { variant: 'dining', icons: ['map', 'restaurant', 'event_note'] },
  hotelGuide: { variant: 'hotels', icons: ['map', 'hotel', 'star'] },
  placeDiscover: { variant: 'discover', icons: ['explore', 'map', 'favorite'] },
};

export default function GuideExperienceBand({ t, ns }) {
  const cfg = CONFIG[ns];
  if (!cfg) return null;
  const { variant, icons } = cfg;

  return (
    <section className={`gex gex--${variant}`} aria-labelledby={`gex-title-${variant}`}>
      <header className="gex__head">
        <h2 id={`gex-title-${variant}`} className="gex__title">
          {t(ns, 'experienceTitle')}
        </h2>
        <p className="gex__lead">{t(ns, 'experienceLead')}</p>
      </header>
      <div className="gex__grid">
        {[0, 1, 2].map((i) => (
          <article key={i} className="gex__card" style={{ animationDelay: `${80 + i * 70}ms` }}>
            <div className="gex__iconWrap" aria-hidden>
              <Icon name={icons[i]} size={22} />
            </div>
            <h3 className="gex__cardTitle">{t(ns, `experienceCol${i + 1}Title`)}</h3>
            <p className="gex__cardBody">{t(ns, `experienceCol${i + 1}Body`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

import SponsoredPlaceCard from '../SponsoredPlaceCard';

export default function SponsoredSection({ enabled, items, t }) {
  if (!enabled || !items || items.length === 0) return null;

  return (
    <section className="vd-section vd-sponsored" aria-label={t('discover', 'sponsoredSectionTitle')}>
      <div className="vd-container">
        <header className="vd-section-head vd-sponsored-head">
          <h2 className="vd-section-title">{t('discover', 'sponsoredSectionTitle')}</h2>
          <p className="vd-section-subtitle vd-sponsored-sub">{t('discover', 'sponsoredSectionSub')}</p>
        </header>
        <div className="vd-sponsored-grid">
          {items.slice(0, 6).map((item) => (
            <SponsoredPlaceCard 
              key={item.id || item.placeId} 
              item={item} 
              t={t} 
              variant="tile" 
            />
          ))}
        </div>
      </div>
    </section>
  );
}

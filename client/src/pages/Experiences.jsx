import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';
import Icon from '../components/Icon';
import { getPlaceImageUrl } from '../api';
import './Explore.css';

function TourCard({ tour }) {
  const img = getPlaceImageUrl(tour.image) || null;
  return (
    <Link to={`/tour/${tour.id}`} className="vd-card vd-card--tour">
      <div className="vd-card-media" style={{ backgroundImage: img ? `url(${img})` : undefined }}>
        {!img && <span className="vd-card-fallback">Tour</span>}
        {tour.duration && <span className="vd-card-badge">{tour.duration}</span>}
      </div>
      <div className="vd-card-content">
        <h3 className="vd-card-title vd-card-title--dark">{tour.name}</h3>
        {tour.priceDisplay && <p className="vd-card-meta vd-card-price">{tour.priceDisplay}</p>}
      </div>
    </Link>
  );
}

const EXPERIENCE_SECTIONS = [
  { id: 'tours', titleKey: 'megaExperiences', descKey: 'megaExperiencesDesc' },
  { id: 'guided', titleKey: 'megaTours', descKey: 'megaToursDesc' },
  { id: 'cultural', titleKey: 'megaCulturalExp', descKey: 'megaCulturalExpDesc' },
  { id: 'book', titleKey: 'megaBookExp', descKey: 'megaBookExpDesc' },
];

export default function Experiences() {
  const { t, lang } = useLanguage();
  const langParam = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.tours.list({ lang: langParam })
      .then((r) => setTours(Array.isArray(r.featured) ? r.featured : []))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [langParam]);

  if (loading) {
    return (
      <div className="vd">
        <div className="vd-loading">
          <div className="vd-loading-spinner" aria-hidden="true" />
          <span>{t('home', 'loading')}</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="vd">
        <div className="vd-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="vd">
      <header className="vd-page-hero">
        <div className="vd-container vd-page-hero-inner">
          <h1 className="vd-page-hero-title">{t('home', 'experiencesTours')}</h1>
          <p className="vd-page-hero-sub">{t('home', 'experiencesSub')}</p>
        </div>
      </header>
      <div className="vd-container">
        {EXPERIENCE_SECTIONS.map((sec, idx) => (
          <section key={sec.id} id={sec.id} className="vd-section vd-experiences-section" style={{ scrollMarginTop: '100px' }}>
            <h2 className="vd-section-title">{t('nav', sec.titleKey)}</h2>
            <p className="vd-section-subtitle">{t('nav', sec.descKey)}</p>
            {idx === 0 ? (
              tours.length === 0 ? (
                <p className="vd-empty">{t('home', 'noTours')}</p>
              ) : (
                <div className="vd-grid vd-grid--4">
                  {tours.map((tour) => (
                    <TourCard key={tour.id} tour={tour} />
                  ))}
                </div>
              )
            ) : null}
          </section>
        ))}
        <p style={{ marginTop: 24 }}>
          <Link to="/map" className="vd-btn vd-btn--secondary">{t('home', 'viewMap')} <Icon name="arrow_forward" size={20} /></Link>
        </p>
      </div>
    </div>
  );
}

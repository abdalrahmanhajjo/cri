import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { getApiOrigin } from '../../utils/apiOrigin';

const TRIPOLI_TIMEZONE = 'Asia/Beirut';

function TripoliClock({ title, condition, locale, dateLabel, timezoneLabel }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const opts = { timeZone: TRIPOLI_TIMEZONE };
  const safeLocale = typeof locale === 'string' ? locale : 'en-GB';
  const timeStr = now.toLocaleTimeString(safeLocale, { ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString(safeLocale, { ...opts, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const safeTitle = title ?? '';
  const safeCondition = condition ?? '';
  const safeDateLabel = dateLabel ?? 'Date';
  const safeTimezoneLabel = timezoneLabel ?? 'Time zone';
  return (
    <div className="vd-widget vd-widget--open vd-tripoli-clock" aria-live="polite" aria-label={safeTitle || 'Tripoli local time'}>
      <div className="vd-widget-left">
        <h3 className="vd-widget-title">{safeTitle}</h3>
        <div className="vd-widget-main">
          <span className="vd-widget-value vd-tripoli-clock-time">{timeStr}</span>
          <span className="vd-widget-icon vd-tripoli-clock-icon" aria-hidden="true" title="Tripoli local time">
            <svg width="34" height="34" viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <p className="vd-widget-condition">{safeCondition}</p>
      </div>
      <div className="vd-widget-right">
        <div className="vd-widget-details">
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{safeDateLabel}</span>
            <span className="vd-widget-detail-value">{dateStr}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{safeTimezoneLabel}</span>
            <span className="vd-widget-detail-value">Asia/Beirut</span>
        </div>
      </div>
      </div>
    </div>
  );
}

function tripoliWeatherApiUrl() {
  const base = getApiOrigin();
  const path = '/api/public/weather/tripoli';
  return base ? `${base}${path}` : path;
}

function wmoToConditionKey(code) {
  if (code === 0 || code === 1) return 'weatherSunny';
  if (code === 2) return 'weatherPartlyCloudy';
  if (code === 3) return 'weatherCloudy';
  if (code === 45 || code === 48) return 'weatherFog';
  if (code >= 51 && code <= 57) return 'weatherDrizzle';
  if (code >= 61 && code <= 67 || (code >= 80 && code <= 82)) return 'weatherRain';
  if (code >= 71 && code <= 77) return 'weatherSnow';
  if (code >= 95 && code <= 99) return 'weatherThunderstorm';
  return 'weatherSunny';
}

function WeatherIcon({ code }) {
  if (code === 0 || code === 1) return <span className="vd-weather-sun" aria-hidden="true" />;
  if (code === 2) return <span className="vd-weather-partly-cloudy" aria-hidden="true" />;
  if (code === 3) return <span className="vd-weather-cloudy" aria-hidden="true" />;
  if (code >= 51 && code <= 67 || (code >= 80 && code <= 82)) return <span className="vd-weather-rain" aria-hidden="true" />;
  if (code >= 95 && code <= 99) return <span className="vd-weather-storm" aria-hidden="true" />;
  return <span className="vd-weather-sun" aria-hidden="true" />;
}

function WeatherTripoli({
  title,
  sunriseLabel,
  sunsetLabel,
  lowLabel,
  highLabel,
  humidityLabel,
  windLabel,
  celsiusLabel,
  fahrenheitLabel,
  t,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState('c');
  useEffect(() => {
    let cancelled = false;
    const url = tripoliWeatherApiUrl();
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 502 ? 'Weather temporarily unavailable' : `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err ?? 'Failed to load'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || error || !data || !data.current || !data.daily) {
    return (
      <div className="vd-widget vd-widget--open vd-weather-tripoli">
        <h3 className="vd-widget-title">{title ?? 'Weather'}</h3>
        <div className="vd-widget-loading">
          {loading ? t('home', 'loading') : '—'}
        </div>
      </div>
    );
  }

  const cur = data.current;
  const daily = data.daily;
  const tempC = cur && typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 0;
  const tempF = (tempC * 9) / 5 + 32;
  const displayTemp = unit === 'c' ? `${Number(tempC).toFixed(1)}°` : `${Number(tempF).toFixed(1)}°`;
  const conditionKey = wmoToConditionKey(cur && typeof cur.weather_code === 'number' ? cur.weather_code : 0);
  const lowC = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
  const highC = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
  const lowF = lowC != null && typeof lowC === 'number' ? (lowC * 9) / 5 + 32 : null;
  const highF = highC != null && typeof highC === 'number' ? (highC * 9) / 5 + 32 : null;
  const sunriseArr = Array.isArray(daily.sunrise) ? daily.sunrise[0] : null;
  const sunsetArr = Array.isArray(daily.sunset) ? daily.sunset[0] : null;
  const sunrise = typeof sunriseArr === 'string' && sunriseArr.length >= 16 ? sunriseArr.slice(11, 16) : '—';
  const sunset = typeof sunsetArr === 'string' && sunsetArr.length >= 16 ? sunsetArr.slice(11, 16) : '—';
  const humidity = cur && typeof cur.relative_humidity_2m === 'number' ? `${cur.relative_humidity_2m}%` : '—';
  const wind = cur && (typeof cur.wind_speed_10m === 'number' || typeof cur.wind_speed_10m === 'string') ? `${cur.wind_speed_10m} km/h` : '—';

  return (
    <div className="vd-widget vd-widget--open vd-weather-tripoli" aria-label={title || 'Weather in Tripoli'}>
      <div className="vd-widget-left">
        <h3 className="vd-widget-title">{title}</h3>
        <div className="vd-widget-main">
          <span className="vd-widget-value vd-weather-temp">{displayTemp}</span>
          <span className="vd-widget-icon vd-weather-icon" aria-hidden="true">
            <WeatherIcon code={cur.weather_code} />
          </span>
        </div>
        <p className="vd-widget-condition">{t('home', conditionKey)}</p>
        <div className="vd-widget-units">
          <button type="button" className={unit === 'c' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('c')}>{celsiusLabel}</button>
          <button type="button" className={unit === 'f' ? 'vd-widget-unit vd-widget-unit--active' : 'vd-widget-unit'} onClick={() => setUnit('f')}>{fahrenheitLabel}</button>
        </div>
      </div>
      <div className="vd-widget-right">
        <div className="vd-widget-details">
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{sunriseLabel}</span>
            <span className="vd-widget-detail-value">{sunrise}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{sunsetLabel}</span>
            <span className="vd-widget-detail-value">{sunset}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{lowLabel}</span>
            <span className="vd-widget-detail-value">{unit === 'c' ? (lowC != null ? `${Number(lowC).toFixed(1)}°` : '—') : (lowF != null ? `${Number(lowF).toFixed(1)}°` : '—')}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{highLabel}</span>
            <span className="vd-widget-detail-value">{unit === 'c' ? (highC != null ? `${Number(highC).toFixed(1)}°` : '—') : (highF != null ? `${Number(highF).toFixed(1)}°` : '—')}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{humidityLabel}</span>
            <span className="vd-widget-detail-value">{humidity}</span>
          </div>
          <div className="vd-widget-detail">
            <span className="vd-widget-detail-label">{windLabel}</span>
            <span className="vd-widget-detail-value">{wind}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanVisitSection({ t, lang, showMap }) {
  return (
    <section id="plan" className="vd-section vd-plan">
      <div className="vd-container vd-plan-inner">
        <h2 className="vd-plan-title">{t('home', 'planTitle')}</h2>
        <div className="vd-plan-card">
          <div className="vd-widgets-row">
            <TripoliClock
              title={t('home', 'tripoliClockLabel')}
              condition={t('home', 'tripoliClockCondition')}
              locale={lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB'}
              dateLabel={t('home', 'tripoliClockDate')}
              timezoneLabel={t('home', 'tripoliClockTimezone')}
            />
            <WeatherTripoli
              title={t('home', 'weatherInTripoli')}
              sunriseLabel={t('home', 'weatherSunrise')}
              sunsetLabel={t('home', 'weatherSunset')}
              lowLabel={t('home', 'weatherLow')}
              highLabel={t('home', 'weatherHigh')}
              humidityLabel={t('home', 'weatherHumidity')}
              windLabel={t('home', 'weatherWind')}
              celsiusLabel={t('home', 'weatherCelsius')}
              fahrenheitLabel={t('home', 'weatherFahrenheit')}
              t={t}
            />
          </div>
        </div>
        <p className="vd-plan-text">{t('home', 'planText')}</p>
        {showMap && (
          <div className="vd-plan-ctas">
            <Link to="/map" className="vd-btn vd-btn--primary">
              {t('home', 'viewMapCta')}
              <Icon name="arrow_forward" className="vd-btn-arrow" size={20} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

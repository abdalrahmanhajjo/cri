import { Link } from 'react-router-dom';
import { COMMUNITY_PATH } from '../../utils/discoverPaths';
import { resolveFooterTagline } from '../../config/resolveSiteTagline';

export default function HomeFooter({ settings, t, showMap }) {
  return (
    <footer className="vd-footer">
      <div className="vd-container vd-footer-inner">
        <div className="vd-footer-brand">
          <Link to="/" className="vd-footer-logo">{settings.siteName?.trim() || t('nav', 'visitTripoli')}</Link>
          <span className="vd-footer-tagline">{resolveFooterTagline(settings, t)}</span>
        </div>
        {(settings.contactEmail || settings.contactPhone) && (
          <p className="vd-footer-contact-line">
            {settings.contactEmail?.trim() && (
              <a href={`mailto:${settings.contactEmail.trim()}`}>{settings.contactEmail.trim()}</a>
            )}
            {settings.contactEmail?.trim() && settings.contactPhone?.trim() && ' · '}
            {settings.contactPhone?.trim() && <span>{settings.contactPhone.trim()}</span>}
          </p>
        )}
        {(settings.socialFacebook?.trim() || settings.socialInstagram?.trim() || settings.socialTwitterX?.trim()) && (
          <div className="vd-footer-social">
            {settings.socialFacebook?.trim() && (
              <a href={settings.socialFacebook.trim()} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            )}
            {settings.socialInstagram?.trim() && (
              <a href={settings.socialInstagram.trim()} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {settings.socialTwitterX?.trim() && (
              <a href={settings.socialTwitterX.trim()} target="_blank" rel="noopener noreferrer">
                X
              </a>
            )}
          </div>
        )}
        <div className="vd-footer-links">
          {showMap && <Link to="/map">{t('home', 'map')}</Link>}
          <Link to={COMMUNITY_PATH}>{t('nav', 'discoverTripoli')}</Link>
          <Link to="/login">{t('nav', 'signIn')}</Link>
          <Link to="/register">{t('nav', 'signUp')}</Link>
          {settings.supportUrl?.trim() && (
            <a href={settings.supportUrl.trim()} target="_blank" rel="noopener noreferrer">
              {t('home', 'contactUs')}
            </a>
          )}
        </div>
        <p className="vd-footer-copy">
          © {new Date().getFullYear()} {settings.siteName?.trim() || t('nav', 'visitTripoli')}. {t('home', 'copyright')}
        </p>
      </div>
    </footer>
  );
}

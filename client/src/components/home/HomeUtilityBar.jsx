import { Link } from 'react-router-dom';
import Icon from '../Icon';

export default function HomeUtilityBar({ t, showMap }) {
  return (
    <div className="vd-utility-bar">
      <div className="vd-container vd-utility-inner">
        {showMap && (
          <Link to="/map" className="vd-utility-link">
            <Icon name="location_on" className="vd-utility-icon" size={20} />
            {t('home', 'map')}
          </Link>
        )}
        <a href="#plan" className="vd-utility-link">
          <Icon name="schedule" className="vd-utility-icon" size={20} />
          {t('home', 'planTitle')}
        </a>
        <a href="#experience" className="vd-utility-link vd-utility-a11y" aria-label={t('home', 'accessibility')}>
          <Icon name="accessibility" className="vd-utility-icon" size={20} />
          {t('home', 'accessibility')}
        </a>
      </div>
    </div>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import './AiPlannerChatDock.css';

/** Global FAB: opens AI trip planner chat (HCI principles live on that page). */
export default function AiPlannerChatDock() {
  const { t } = useLanguage();
  const { pathname } = useLocation();

  if (pathname === '/plan/ai') return null;

  return (
    <Link
      to="/plan/ai"
      className="ai-planner-chat-dock"
      aria-label={t('aiPlanner', 'chatDockAria')}
    >
      <span className="ai-planner-chat-dock__icon" aria-hidden>
        <Icon name="auto_awesome" size={18} />
      </span>
      <span>{t('aiPlanner', 'chatDockLabel')}</span>
    </Link>
  );
}

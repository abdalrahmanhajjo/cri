import { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './css/HciSettingsPanel.css';

const HCI_IDS = [
  { id: 'feedback', highlight: true },
  { id: 'input' },
  { id: 'output' },
  { id: 'memory' },
  { id: 'context' },
];

/** HCI principles + email feedback — shown under Profile → settings-style section. */
export default function HciSettingsPanel() {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const contactEmail = t('home', 'contactEmailValue');

  const mailHref = useMemo(() => {
    const bodyText = message.trim();
    const subject = `Visit Tripoli — feedback (${typeof window !== 'undefined' ? window.location.pathname : ''})`;
    const lines = [
      bodyText,
      '',
      '---',
      `Page: ${typeof window !== 'undefined' ? window.location.href : ''}`,
      email.trim() ? `Reply-to: ${email.trim()}` : '',
    ].filter(Boolean);
    const body = lines.join('\n');
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [contactEmail, message, email]);

  const messageOk = message.trim().length >= 4;

  return (
    <div className="hci-settings-panel">
      <details className="hci-settings-panel__details" open>
        <summary className="hci-settings-panel__summary">{t('aiPlanner', 'hciPrinciplesSummary')}</summary>
        <p className="hci-settings-panel__lead">{t('aiPlanner', 'hciPrinciplesLead')}</p>
        <div className="hci-settings-panel__grid">
          {HCI_IDS.map(({ id, highlight }) => (
            <div
              key={id}
              className={`hci-settings-panel__card${highlight ? ' hci-settings-panel__card--feedback' : ''}`}
            >
              {highlight ? (
                <span className="hci-settings-panel__badge">{t('hci', 'feedbackBadge')}</span>
              ) : null}
              <h3 className="hci-settings-panel__card-title">{t('hci', `${id}Title`)}</h3>
              <p className="hci-settings-panel__card-text">{t('hci', `${id}Desc`)}</p>
            </div>
          ))}
        </div>

        <div className="hci-settings-panel__form">
          <h3 className="hci-settings-panel__form-title">{t('hci', 'formTitle')}</h3>
          <p className="hci-settings-panel__form-hint">{t('hci', 'formHint')}</p>
          {touched && !messageOk ? (
            <p className="hci-settings-panel__err" role="alert">
              {t('hci', 'messageTooShort')}
            </p>
          ) : null}
          <div className="hci-settings-panel__field">
            <label htmlFor="profile-hci-feedback-msg" className="hci-settings-panel__label">
              {t('hci', 'messageLabel')}
            </label>
            <textarea
              id="profile-hci-feedback-msg"
              className="hci-settings-panel__textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('hci', 'messagePlaceholder')}
              autoComplete="off"
              rows={4}
            />
          </div>
          <div className="hci-settings-panel__field">
            <label htmlFor="profile-hci-feedback-email" className="hci-settings-panel__label">
              {t('hci', 'emailLabel')}
            </label>
            <input
              id="profile-hci-feedback-email"
              type="email"
              className="hci-settings-panel__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('hci', 'emailPlaceholder')}
              autoComplete="email"
            />
          </div>
          <div className="hci-settings-panel__actions">
            <a
              className="hci-settings-panel__submit"
              href={messageOk ? mailHref : undefined}
              aria-disabled={!messageOk}
              onClick={(e) => {
                if (!messageOk) e.preventDefault();
              }}
            >
              {t('hci', 'sendEmail')}
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}

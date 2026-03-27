import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';
import './HciFeedbackDock.css';

const COMPONENTS = [
  { id: 'feedback', highlight: true },
  { id: 'input' },
  { id: 'output' },
  { id: 'memory' },
  { id: 'context' },
];

export default function HciFeedbackDock() {
  const { t } = useLanguage();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef(null);
  const fabRef = useRef(null);

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

  useEffect(() => {
    if (!open) return undefined;

    const prevActive = document.activeElement;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevActive && typeof prevActive.focus === 'function') {
        try {
          prevActive.focus();
        } catch {
          fabRef.current?.focus();
        }
      }
    };
  }, [open]);

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="hci-dock-fab"
        onClick={() => setOpen(true)}
        aria-label={t('hci', 'fabAria')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
      >
        <span className="hci-dock-fab-icon" aria-hidden="true">
          <Icon name="chat" size={16} />
        </span>
        <span>{t('hci', 'fabLabel')}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="hci-dock-backdrop"
            aria-label={t('hci', 'closeBackdrop')}
            onClick={() => setOpen(false)}
          />
          <div
            className="hci-dock-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="hci-dock-panel-head">
              <h2 id={titleId} className="hci-dock-panel-title">
                {t('hci', 'panelTitle')}
              </h2>
              <button
                type="button"
                className="hci-dock-close"
                onClick={() => setOpen(false)}
                aria-label={t('hci', 'close')}
              >
                ×
              </button>
            </div>
            <div className="hci-dock-scroll">
              <p className="hci-dock-intro">{t('hci', 'panelIntro')}</p>
              <div className="hci-dock-cards">
                {COMPONENTS.map(({ id, highlight }) => (
                  <div
                    key={id}
                    className={`hci-dock-card${highlight ? ' hci-dock-card--feedback' : ''}`}
                  >
                    {highlight && (
                      <span className="hci-dock-badge">{t('hci', 'feedbackBadge')}</span>
                    )}
                    <h3>{t('hci', `${id}Title`)}</h3>
                    <p>{t('hci', `${id}Desc`)}</p>
                  </div>
                ))}
              </div>
              <div className="hci-dock-form">
                <h3>{t('hci', 'formTitle')}</h3>
                <p className="hci-dock-form-hint">{t('hci', 'formHint')}</p>
                {touched && !messageOk && (
                  <p className="hci-dock-err" role="alert">
                    {t('hci', 'messageTooShort')}
                  </p>
                )}
                <div className="hci-dock-field">
                  <label htmlFor="hci-feedback-msg">{t('hci', 'messageLabel')}</label>
                  <textarea
                    id="hci-feedback-msg"
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder={t('hci', 'messagePlaceholder')}
                    autoComplete="off"
                  />
                </div>
                <div className="hci-dock-field">
                  <label htmlFor="hci-feedback-email">{t('hci', 'emailLabel')}</label>
                  <input
                    id="hci-feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('hci', 'emailPlaceholder')}
                    autoComplete="email"
                  />
                </div>
                <div className="hci-dock-actions">
                  <a
                    className="hci-dock-submit"
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
            </div>
          </div>
        </>
      )}
    </>
  );
}

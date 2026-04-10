import { useEffect, useLayoutEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import './AiPlannerOnboarding.css';

/**
 * Full-screen coach overlay: dimmed backdrop, optional spotlight hole, floating step card.
 */
export default function AiPlannerOnboarding({
  open,
  stepIndex,
  stepCount,
  title,
  body,
  highlightRect,
  onNext,
  onBack,
  onSkip,
  isLastStep,
  nextLabel,
  backLabel,
  skipLabel,
  doneLabel,
  progressLabel,
  dir = 'ltr',
}) {
  const panelRef = useRef(null);
  const onSkipRef = useRef(onSkip);
  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);
  const headingId = useId();
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector('button:not([disabled])');
    if (el && typeof el.focus === 'function') {
      window.requestAnimationFrame(() => el.focus());
    }
  }, [open, stepIndex]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkipRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY ?? html.scrollTop ?? 0;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;

    html.setAttribute('data-guided-tour', '1');
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      html.removeAttribute('data-guided-tour');
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const pad = 10;
  const hole =
    highlightRect &&
    highlightRect.width > 4 &&
    highlightRect.height > 4 &&
    Number.isFinite(highlightRect.top)
      ? {
          top: highlightRect.top - pad,
          left: highlightRect.left - pad,
          width: highlightRect.width + pad * 2,
          height: highlightRect.height + pad * 2,
          borderRadius: 14,
        }
      : null;

  const tooltipStyle =
    hole && highlightRect
      ? (() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const isWide = vw >= 900;
          const horizontalPad = isWide ? 32 : 24;
          const cardW = Math.min(isWide ? 460 : 400, vw - horizontalPad);
          const safeBottom = 20;
          const cardEstimateH = Math.min(
            isWide ? 420 : Math.round(vh * 0.86),
            Math.max(220, vh - safeBottom - 12)
          );
          let top = hole.top + hole.height + 16;
          if (top + cardEstimateH > vh - safeBottom) {
            top = Math.max(safeBottom, hole.top - 16 - cardEstimateH);
          }
          top = Math.max(12, Math.min(top, vh - cardEstimateH - safeBottom));
          let left = hole.left + hole.width / 2 - cardW / 2;
          const edge = isWide ? 24 : 12;
          left = Math.max(edge, Math.min(left, vw - cardW - edge));
          return { top, left, width: cardW };
        })()
      : {};

  const content = (
    <div
      className="ai-planner-tour"
      role="presentation"
      aria-hidden={false}
    >
      <div
        className={`ai-planner-tour__backdrop${hole ? ' ai-planner-tour__backdrop--spotlight' : ''}${reduceMotion ? ' ai-planner-tour--reduced-motion' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {hole ? (
          <>
            <div
              className="ai-planner-tour__hole-cutout"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: hole.borderRadius,
              }}
            />
            {!reduceMotion ? (
              <div
                className="ai-planner-tour__pulse-ring"
                style={{
                  top: hole.top,
                  left: hole.left,
                  width: hole.width,
                  height: hole.height,
                  borderRadius: hole.borderRadius,
                }}
                aria-hidden
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div
        ref={panelRef}
        dir={dir}
        className={`ai-planner-tour__panel${hole ? ' ai-planner-tour__panel--floating' : ' ai-planner-tour__panel--center'}`}
        style={hole ? tooltipStyle : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="ai-planner-tour__panel-head">
          <span className="ai-planner-tour__badge" aria-live="polite">
            {progressLabel.replace(/\{current\}/g, String(stepIndex + 1)).replace(/\{total\}/g, String(stepCount))}
          </span>
          <button type="button" className="ai-planner-tour__close" onClick={onSkip} aria-label={skipLabel}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <h2 id={headingId} className="ai-planner-tour__title">
          {title}
        </h2>
        <p className="ai-planner-tour__body">{body}</p>
        <div className="ai-planner-tour__dots" aria-hidden>
          {Array.from({ length: stepCount }, (_, i) => (
            <span key={i} className={`ai-planner-tour__dot${i === stepIndex ? ' ai-planner-tour__dot--on' : ''}`} />
          ))}
        </div>
        <div className="ai-planner-tour__actions">
          <button
            type="button"
            className="ai-planner-tour__btn ai-planner-tour__btn--ghost ai-planner-tour__btn--back"
            onClick={onBack}
          >
            <Icon name="arrow_back" size={18} aria-hidden />
            {backLabel}
          </button>
          <div className="ai-planner-tour__actions-primary">
            <button type="button" className="ai-planner-tour__btn ai-planner-tour__btn--ghost" onClick={onSkip}>
              {skipLabel}
            </button>
            <button type="button" className="ai-planner-tour__btn ai-planner-tour__btn--primary" onClick={onNext}>
              {isLastStep ? doneLabel : nextLabel}
              {!isLastStep ? <Icon name="arrow_forward" size={18} aria-hidden /> : <Icon name="check_circle" size={18} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

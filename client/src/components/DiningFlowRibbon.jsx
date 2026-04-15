import Icon from './Icon';

const STEPS = [
  { id: '', icon: 'restaurant' },
  { id: 'reserve', icon: 'event_note' },
  { id: 'order', icon: 'storefront' },
  { id: 'menu', icon: 'menu_book' },
  { id: 'offers', icon: 'sell' },
];

export default function DiningFlowRibbon({ activeFlow, onSelectFlow, t, flowCounts }) {
  return (
    <nav className="dg-flow dg-flow--compact" aria-label={t('diningGuide', 'flowSectionLabel')}>
      <div className="dg-flow__grid dg-flow__grid--scroll" role="tablist">
        {STEPS.map((step) => {
          const on = (activeFlow || '') === step.id;
          const key = step.id || 'all';
          const n = flowCounts && typeof flowCounts[key] === 'number' ? flowCounts[key] : null;
          const label = t('diningGuide', `flowLabel_${key}`);
          const hint = t('diningGuide', `flowHint_${key}`);
          return (
            <button
              key={step.id || 'all'}
              type="button"
              role="tab"
              aria-selected={on}
              className={`dg-flow__card ${on ? 'dg-flow__card--on' : ''}`}
              onClick={() => onSelectFlow(step.id)}
              aria-label={`${label}. ${hint}`}
            >
              <span className="dg-flow__iconWrap" aria-hidden>
                <Icon name={step.icon} size={20} />
              </span>
              <span className="dg-flow__text">
                <span className="dg-flow__labelRow">
                  <span className="dg-flow__label">{label}</span>
                  {n != null ? (
                    <span className="dg-flow__count" aria-hidden>
                      {n}
                    </span>
                  ) : null}
                </span>
                <span className="hg-sr-only">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

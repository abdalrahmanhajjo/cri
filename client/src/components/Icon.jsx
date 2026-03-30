import { getIconDoc } from '../config/iconRegistry';
import { getBootstrapIconSlug } from '../config/bootstrapIconMap';

// Subset only (see bootstrapIconMap): Vite inlines eager globs; *.svg would ship ~2k files.
const rawSvgs = import.meta.glob(
  '../../node_modules/bootstrap-icons/icons/{arrow-bar-up,arrow-left,arrow-right,arrow-up,arrows-fullscreen,at,balloon-fill,bank,bookmark,bookmark-fill,box-arrow-right,box-arrow-up-right,buildings,calendar-day,calendar-event-fill,calendar-month,camera-fill,car-front-fill,cash-coin,chat,chat-dots-fill,chat-left-text-fill,check-circle-fill,check-lg,chevron-down,chevron-left,chevron-right,chevron-up,circle,clipboard,clock,compass,compass-fill,crosshair,cup-hot-fill,dash-circle,dash-lg,diagram-3,envelope,envelope-check,exclamation-circle,exclamation-triangle-fill,eye,eye-slash,film,funnel,geo-alt,geo-alt-fill,globe2,google-play,grid-3x3-gap-fill,hand-index,heart,heart-fill,hourglass-split,images,journal-text,key-fill,lightning-charge,link-45deg,list-task,list-ul,lock-fill,map,moon-stars-fill,patch-check-fill,pencil-square,people-fill,person-circle,person-fill,person-plus-fill,person-walking,phone,phone-fill,pin-map-fill,play-circle-fill,plus-lg,printer,question-circle,reply,rss,search,send-fill,share,shield-check,shield-lock,shop,signpost-fill,sliders,star-fill,stars,tag-fill,three-dots,three-dots-vertical,ticket-perforated,trash,tree,universal-access-circle,volume-mute-fill,volume-up-fill,water,x-lg}.svg',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

function rawSvgForSlug(slug) {
  const hit = Object.keys(rawSvgs).find((p) => p.endsWith(`/${slug}.svg`));
  return hit ? rawSvgs[hit] : null;
}

/**
 * Static SVG icon from [Bootstrap Icons](https://github.com/twbs/icons) (MIT).
 * `name` stays the Material-style key used across the app; it is mapped internally.
 * Accessibility notes: `config/iconRegistry.js` → `getIconDoc`.
 */
export default function Icon({
  name,
  className = '',
  size = 24,
  ariaHidden = true,
  title,
  ...props
}) {
  const doc = getIconDoc(name);
  const slug = getBootstrapIconSlug(name);
  let svg = rawSvgForSlug(slug);
  if (!svg) svg = rawSvgForSlug('question-circle');

  const { style: propStyle, 'aria-hidden': ariaHiddenDash, ...restProps } = props;
  let hidden = ariaHidden;
  if (ariaHiddenDash === true || ariaHiddenDash === 'true') hidden = true;
  if (ariaHiddenDash === false || ariaHiddenDash === 'false') hidden = false;

  const label = title ?? (hidden ? undefined : doc.description);

  return (
    <span
      className={`icon icon--bootstrap ${className}`.trim()}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        lineHeight: 0,
        color: 'inherit',
        ...(propStyle || {}),
      }}
      aria-hidden={hidden ? true : undefined}
      aria-label={label}
      role={hidden ? undefined : 'img'}
      title={hidden ? undefined : doc.description}
      {...restProps}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

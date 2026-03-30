import { useRef, useEffect, useMemo } from 'react';
import Lottie from 'lottie-react';
import { getIconDoc } from '../config/iconRegistry';

const variantModules = import.meta.glob('../assets/lottie-by-variant/*.json', {
  eager: true,
  import: 'default',
});
const overrideModules = import.meta.glob('../assets/flaticon-overrides/*.json', {
  eager: true,
  import: 'default',
});

function pickModule(map, slug, folder) {
  const hit = Object.keys(map).find((p) => p.includes(`${folder}/${slug}.json`));
  return hit ? map[hit] : null;
}

function usePrefersReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

/**
 * Animated Lottie icon. Default animations are small in-repo placeholders per family
 * (replace with Flaticon Lottie JSON in `src/assets/flaticon-overrides/{name}.json` when licensed).
 * Semantics: see `getIconDoc` in `config/iconRegistry.js`.
 */
export default function Icon({
  name,
  className = '',
  size = 24,
  ariaHidden = true,
  title,
  ...props
}) {
  const reduceMotion = usePrefersReducedMotion();
  const lottieRef = useRef(null);
  const doc = getIconDoc(name);
  const animationData =
    pickModule(overrideModules, name, 'flaticon-overrides') ||
    pickModule(variantModules, doc.variant, 'lottie-by-variant');

  const { style: propStyle, 'aria-hidden': ariaHiddenDash, ...restProps } = props;
  let hidden = ariaHidden;
  if (ariaHiddenDash === true || ariaHiddenDash === 'true') hidden = true;
  if (ariaHiddenDash === false || ariaHiddenDash === 'false') hidden = false;

  useEffect(() => {
    if (!reduceMotion || !lottieRef.current) return;
    try {
      lottieRef.current.goToAndStop(0, true);
    } catch {
      /* noop */
    }
  }, [reduceMotion, name, animationData]);

  const label = title ?? (hidden ? undefined : doc.description);

  if (!animationData) {
    return (
      <span
        className={`material-symbols-outlined icon ${className}`.trim()}
        style={{ fontSize: size, ...(propStyle || {}) }}
        aria-hidden={hidden ? true : undefined}
        aria-label={label}
        role={hidden ? undefined : 'img'}
        {...restProps}
      >
        {name}
      </span>
    );
  }

  return (
    <span
      className={`icon icon--lottie ${className}`.trim()}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        lineHeight: 0,
        ...(propStyle || {}),
      }}
      aria-hidden={hidden ? true : undefined}
      aria-label={label}
      role={hidden ? undefined : 'img'}
      title={hidden ? undefined : doc.description}
      {...restProps}
    >
      <Lottie
        animationData={animationData}
        loop={!reduceMotion}
        autoplay={!reduceMotion}
        lottieRef={lottieRef}
        style={{ width: size, height: size }}
        aria-hidden={hidden}
      />
    </span>
  );
}

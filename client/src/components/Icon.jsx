import { getIconDoc } from '../config/iconRegistry';

/**
 * Material Symbols (Google) — static outline icon font.
 * Names: https://fonts.google.com/icons — use underscore form in JSX (`arrow_back`).
 * Accessibility: `config/iconRegistry.js` → `getIconDoc`.
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
  const { style: propStyle, 'aria-hidden': ariaHiddenDash, ...restProps } = props;
  let hidden = ariaHidden;
  if (ariaHiddenDash === true || ariaHiddenDash === 'true') hidden = true;
  if (ariaHiddenDash === false || ariaHiddenDash === 'false') hidden = false;
  const label = title ?? (hidden ? undefined : doc.description);

  return (
    <span
      className={`material-symbols-outlined icon ${className}`.trim()}
      style={{ fontSize: size, ...(propStyle || {}) }}
      aria-hidden={hidden ? true : undefined}
      aria-label={label}
      role={hidden ? undefined : 'img'}
      title={hidden ? undefined : doc.description}
      {...restProps}
    >
      {name}
    </span>
  );
}

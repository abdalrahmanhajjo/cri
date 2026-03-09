/**
 * Material Symbols icon (Google). Use icon names from https://fonts.google.com/icons
 * Renders as a font so it scales and inherits color; works in Chrome and all modern browsers.
 */
export default function Icon({ name, className = '', size = 24, ariaHidden = true, ...props }) {
  return (
    <span
      className={`material-symbols-outlined icon ${className}`.trim()}
      style={{ fontSize: size }}
      aria-hidden={ariaHidden}
      {...props}
    >
      {name}
    </span>
  );
}

/**
 * Debounce: delay invocation until after waitMs since last call.
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {Function} Debounced function with .cancel()
 */
export function debounce(fn, waitMs) {
  if (typeof fn !== 'function') throw new TypeError('fn must be a function');
  const wait = Math.max(0, Number(waitMs) || 0);
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    if (lastArgs == null) return;
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    fn.apply(ctx, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (timeoutId != null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      invoke();
    }, wait);
  }

  debounced.cancel = () => {
    if (timeoutId != null) clearTimeout(timeoutId);
    timeoutId = null;
    lastArgs = null;
    lastThis = null;
  };

  return debounced;
}

export default debounce;

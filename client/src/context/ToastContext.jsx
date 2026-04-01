import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import './ToastContext.css';

const ToastContext = createContext(null);

const DEFAULT_DURATION_MS = 3800;

/**
 * App-wide toast notifications. Call `showToast(message, type?, durationMs?)` from any route.
 * `type`: 'success' | 'error' | 'info' | 'warning'
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'info', durationMs = DEFAULT_DURATION_MS) => {
    const text = message != null ? String(message).trim() : '';
    if (!text) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const normalized =
      type === 'success' || type === 'error' || type === 'warning' ? type : 'info';
    setToast({ message: text, type: normalized });
    const ms = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : DEFAULT_DURATION_MS;
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, ms);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div
          className={`global-toast global-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

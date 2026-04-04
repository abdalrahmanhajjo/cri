/** Shared loader so Map page and home embed reuse one script tag. */
export function loadGoogleMapsScript(apiKey, onAuthError) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    const hasOurKey = apiKey && existing?.src?.includes(encodeURIComponent(apiKey));
    if (existing && hasOurKey) {
      const check = () => (window.google?.maps ? resolve(window.google.maps) : setTimeout(check, 50));
      check();
      return;
    }
    if (onAuthError && typeof window !== 'undefined') {
      window.gm_authFailure = () => {
        window.gm_authFailure = null;
        onAuthError(
          new Error(
            'Google Maps rejected the API key. Enable Maps JavaScript API, enable billing, and check key restrictions.'
          )
        );
      };
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.maps || reject(new Error('Maps not loaded')));
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

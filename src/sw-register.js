// @ts-check
/**
 * @fileoverview Service Worker registration helper for CraneTrack PWA.
 */

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Non-blocking fallback when SW is unavailable (e.g. file:// or restricted context)
    });
  });
}

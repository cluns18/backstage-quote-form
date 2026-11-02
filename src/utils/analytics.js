// Analytics, carried over from the Local Threads calculator (Vite/React).
// Unified schema with the design lab + quote form: every step fires a
// `funnel_step` event with { funnel, step }, so all three funnels roll up into
// one Looker Studio dashboard. Env-driven and no-ops until ids are set, so it is
// safe to ship before the GA4 property + Clarity project exist.
//
// Set in Vite env (build-time): VITE_GA_MEASUREMENT_ID, VITE_CLARITY_ID.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID;
// Backstage's form is a quote request, so it reports as the quote form funnel.
const FUNNEL = 'quote_form';

let started = false;

export function initAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;

  // GA4
  if (GA_ID) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  // Microsoft Clarity (heatmaps + session replays + rage/dead-click signals)
  if (CLARITY_ID) {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  // Uncaught errors -> GA, so breakages that kill a step become countable.
  window.addEventListener('error', (e) => trackError(e.message, { source: 'window.error' }));
  window.addEventListener('unhandledrejection', (e) =>
    trackError(String(e && e.reason), { source: 'unhandledrejection' })
  );
}

export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try { window.gtag('event', name, params); } catch { /* never throw in user flows */ }
}

export function trackFunnelStep(step, meta = {}) {
  trackEvent('funnel_step', { funnel: FUNNEL, step, ...meta });
}

export function trackError(message, ctx = {}) {
  trackEvent('js_error', {
    funnel: FUNNEL,
    message: String(message).slice(0, 300),
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...ctx,
  });
}

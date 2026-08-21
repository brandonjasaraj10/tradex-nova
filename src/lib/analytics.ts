/*
  Google Analytics 4.

  Loaded from a module rather than pasted inline into index.html, because
  this site's CSP (vercel.json) sets `script-src 'self' https://js.stripe.com`
  with no 'unsafe-inline'. GA's stock snippet is an inline <script>, so it
  would be reported today and hard-blocked the moment that policy is switched
  from Report-Only to enforcing - analytics would silently stop with no
  obvious symptom. Bundled code is served from 'self', so this loads cleanly
  under the existing policy. googletagmanager/google-analytics are added to
  the CSP alongside this.

  Gated on VITE_GA_MEASUREMENT_ID exactly like Sentry's DSN: with no id set
  (local dev, previews, or before the property exists) nothing loads and no
  requests are made, so development traffic never pollutes the reports.
*/

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

// A real GA4 id looks like G-XXXXXXXXXX. Guarding on the shape means a blank
// or half-filled env var is ignored rather than loading a broken tag.
const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && /^G-[A-Z0-9]+$/i.test(id.trim());

export const analyticsEnabled = isValidId(MEASUREMENT_ID);

export function initAnalytics(): void {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  if (window.gtag) return; // already initialised (StrictMode double-invokes)

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag: (...args: unknown[]) => void = (...args) => {
    window.dataLayer.push(args);
  };
  window.gtag = gtag;

  gtag('js', new Date());
  /*
    send_page_view is disabled here and page views are sent manually on route
    change instead. This is a single-page app: the browser only does one real
    page load, so GA's automatic pageview would record the entry page and
    then nothing else - every subsequent navigation would be invisible.
  */
  gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

export function trackPageView(path: string, title?: string): void {
  if (!analyticsEnabled || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title ?? document.title,
  });
}

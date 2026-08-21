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

const OPT_OUT_KEY = 'tradex_analytics_opt_out';

/*
  Per-device opt-out, so the team's own visits don't pollute the reports.

  Visiting any page with ?noanalytics=1 stores a flag in that browser and
  nothing is ever sent from it again; ?noanalytics=0 undoes it. The flag is
  read before gtag loads, and also sets Google's own ga-disable-<ID> switch,
  which suppresses collection even if the tag is loaded by anything else.

  Deliberately not IP-based. GA's built-in internal-traffic filter matches on
  IP, which misses a phone on cellular, any other network, and silently stops
  working whenever a residential IP is reassigned - failing open, with no
  signal that it has stopped excluding anyone. A per-device flag keeps working
  wherever that browser goes. The trade-off is that it has to be set once per
  browser, and is lost if site data is cleared.
*/
function isOptedOut(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('noanalytics');
    if (param === '1') {
      localStorage.setItem(OPT_OUT_KEY, '1');
      return true;
    }
    if (param === '0') {
      localStorage.removeItem(OPT_OUT_KEY);
      return false;
    }
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    // private mode or blocked storage - measure rather than silently drop
    return false;
  }
}

export function initAnalytics(): void {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  if (window.gtag) return; // already initialised (StrictMode double-invokes)

  if (isOptedOut()) {
    // Google reads this exact global and drops everything for that id.
    (window as unknown as Record<string, unknown>)[`ga-disable-${MEASUREMENT_ID}`] = true;
    return;
  }

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
  // gtag is never defined on an opted-out device, so this is also inert there
  if (!analyticsEnabled || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title ?? document.title,
  });
}

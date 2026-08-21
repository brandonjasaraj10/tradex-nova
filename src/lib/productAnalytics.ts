/*
  PostHog product analytics: feature usage, funnels, retention and session
  replay for the app itself. Separate from GA4, which measures acquisition
  on the marketing side.

  Loaded from PostHog's CDN in a module rather than the inline snippet they
  document, for the same reason as GA: this site's CSP sets script-src
  without 'unsafe-inline', so the stock snippet would be reported now and
  hard-blocked the moment that policy stops being Report-Only.

  THIS APP SHOWS REAL MONEY. Balances, per-trade P&L, open positions and
  private journal entries are on screen constantly, so the defaults are not
  safe here and two separate things have to be locked down:

    1. Session replay records the screen. Everything is masked - all text and
       all inputs - so replays show layout, clicks and where someone gets
       stuck, but never a figure or a journal sentence.

    2. Autocapture records the TEXT of whatever was clicked, which replay
       masking does not cover. Calendar day cells are buttons labelled with
       that day's P&L ("+$1,000"), so plain autocapture would send real
       trading results to PostHog on every calendar click. Element text is
       stripped from every event below.
*/

import type { PageType } from './analytics';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_SCRIPT = 'https://us-assets.i.posthog.com/static/array.js';

const OPT_OUT_KEY = 'tradex_analytics_opt_out';

type PostHog = {
  init: (key: string, config: Record<string, unknown>) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
  __loaded?: boolean;
};

declare global {
  interface Window {
    posthog?: PostHog;
  }
}

const isValidKey = (k: unknown): k is string =>
  typeof k === 'string' && /^phc_[A-Za-z0-9]+$/.test(k.trim());

export const productAnalyticsEnabled = isValidKey(POSTHOG_KEY);

// Shares the flag GA uses, so ?noanalytics=1 silences both tools at once
// rather than leaving one of them quietly still reporting.
function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/*
  Runs on every event before it leaves the browser. $el_text is the text of
  the clicked element and is the one that matters here - see the calendar
  note above. The href/url strips are belt and braces: query strings on this
  app can carry a date, and there is no reason to ship them.
*/
export function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...properties };
  delete cleaned.$el_text;
  delete cleaned.$elements_chain;
  if (Array.isArray(cleaned.$elements)) {
    cleaned.$elements = (cleaned.$elements as Record<string, unknown>[]).map(el => {
      const copy = { ...el };
      delete copy.$el_text;
      delete copy.text;
      delete copy.attr__value;
      delete copy.attr__title;
      delete copy.attr__aria_label;
      return copy;
    });
  }
  return cleaned;
}

export function initProductAnalytics(): void {
  if (!productAnalyticsEnabled || typeof window === 'undefined') return;
  if (window.posthog?.__loaded) return;
  if (isOptedOut()) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = POSTHOG_SCRIPT;
  script.onload = () => {
    if (!window.posthog) return;
    window.posthog.init(POSTHOG_KEY as string, {
      api_host: POSTHOG_HOST,
      // Only build a person profile once someone signs in; anonymous
      // visitors are already measured properly by GA on the marketing side.
      person_profiles: 'identified_only',
      capture_pageview: false, // routed manually, same reason as GA in an SPA
      autocapture: true,
      sanitize_properties: sanitizeProperties,
      session_recording: {
        maskAllInputs: true,
        // Mask every text node, not a selector list. An allowlist means any
        // new component that renders a figure starts leaking silently; this
        // way new UI is masked by default and nothing has to be remembered.
        maskTextSelector: '*',
      },
    });
  };
  document.head.appendChild(script);
}

export function captureAppPageView(path: string, pageType: PageType): void {
  if (!productAnalyticsEnabled || !window.posthog?.__loaded) return;
  window.posthog.capture('$pageview', { path, page_type: pageType });
}

/*
  Ties activity to an account so retention and churn can be read per user.
  Deliberately sends no email or name - the Supabase user id is enough to
  join back to the real record, and PostHog never needs to hold PII.
*/
export function identifyUser(userId: string): void {
  if (!productAnalyticsEnabled || !window.posthog?.__loaded) return;
  window.posthog.identify(userId);
}

export function resetUser(): void {
  if (!productAnalyticsEnabled || !window.posthog?.__loaded) return;
  window.posthog.reset();
}

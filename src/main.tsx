import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { initProductAnalytics } from './lib/productAnalytics';
import './index.css';

/*
  Production only.

  This initialised whenever the DSN was set, which includes every dev server
  run - so errors from local development were filed against
  tradex-nova-frontend and emailed out as high-priority alerts. A transient
  mistake mid-edit produced two "ReferenceError in Dashboard" alerts that
  looked exactly like a live outage and were never on the live site at all.

  Alerting whose alerts are usually false is worse than none, because the
  real one arrives looking like the others.
*/
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,

    /*
      Drop errors thrown by in-app browsers rather than by TradeX.

      Opening a link inside Instagram, Facebook or TikTok loads the page in an
      embedded WebView that injects its own instrumentation. That code throws
      during ordinary page teardown - "Error invoking postMessage: Java object
      is gone" is Android garbage-collecting the injected Java bridge while the
      page unloads - and Sentry catches it because its browserapierrors
      integration wraps addEventListener, so anything thrown inside a handler
      is captured whether we wrote it or not.

      Nothing is broken when this fires and the visitor sees nothing. Left
      alone it pages us every time someone taps a link from Instagram, which
      trains us to ignore Sentry mail - the opposite of why it is here.

      Matched on the iabjs:// scheme and the message, so genuine postMessage
      failures in our own code still come through.
    */
    ignoreErrors: [
      'Error invoking postMessage',
      'Java object is gone',
    ],
    beforeSend(event) {
      const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
      const fromInAppBrowser = frames.some((f) =>
        typeof f.filename === 'string' && f.filename.startsWith('iabjs://')
      );
      return fromInAppBrowser ? null : event;
    },
  });
}

// No-op unless VITE_GA_MEASUREMENT_ID is set, same gating as Sentry above.
initAnalytics();
// No-op unless VITE_POSTHOG_KEY is set, and silenced by the same opt-out.
initProductAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
);

function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-400 mb-6">We've been notified and are looking into it.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, setConsent } from '../../lib/consent';
import { initAnalytics } from '../../lib/analytics';
import { initProductAnalytics } from '../../lib/productAnalytics';

/*
  Asks before anything non-essential runs.

  Deliberately not a dark pattern: Accept and Decline are the same size, the
  same shape and equally reachable. A banner where "reject" is a grey link
  under the fold is the thing regulators actually object to, and it is not
  worth the handful of extra sessions it buys.

  Nothing is tracked while this is on screen. Ignoring it is a no, and it
  stays a no - the banner reappears next visit rather than assuming consent
  from silence.
*/
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /*
      Read on mount rather than during render: localStorage throws in some
      privacy modes, and getConsent already swallows that, but keeping it in
      an effect means the first paint never depends on storage at all.
    */
    if (getConsent() === 'unset') setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    setConsent('accepted');
    /*
      Start them here rather than waiting for a reload. Someone who accepts
      and then signs up in the same visit should be measured on that visit -
      otherwise the conversion that consent was asked for goes uncounted.
    */
    initAnalytics();
    initProductAnalytics();
    setVisible(false);
  };

  const decline = () => {
    setConsent('rejected');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-brand-surface/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
        <div className="sm:flex sm:items-center sm:gap-6">
          <p className="text-[13px] sm:text-sm text-gray-400 leading-relaxed">
            We use cookies to understand how the site is used. Nothing runs until
            you say yes, and you can change your mind any time.{' '}
            <Link to="/privacy" className="text-gray-300 underline underline-offset-2 hover:text-white">
              Privacy Policy
            </Link>
          </p>
          <div className="mt-4 sm:mt-0 flex gap-2.5 sm:flex-shrink-0">
            <button
              type="button"
              onClick={decline}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full border border-white/15
                text-[13px] font-medium text-gray-300 hover:bg-white/5 transition-colors
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={accept}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-white text-black
                text-[13px] font-medium hover:bg-gray-200 transition-colors
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

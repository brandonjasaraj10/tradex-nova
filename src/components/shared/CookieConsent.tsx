import { useState, useEffect, useCallback } from 'react';
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

/* Matches the duration on the panel below. Kept as a constant so the timeout
   that unmounts the banner and the CSS that animates it can never drift. */
const TRANSITION_MS = 320;

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    /*
      Read on mount rather than during render: localStorage throws in some
      privacy modes, and getConsent already swallows that, but keeping it in
      an effect means the first paint never depends on storage at all.
    */
    if (getConsent() !== 'unset') return;
    setMounted(true);

    /*
      A beat before it slides up.

      Two reasons for the delay rather than animating immediately. It lets the
      page paint first, so the banner reads as arriving rather than as part of
      the layout - and it keeps it out of the way of the hero for the moment
      someone spends deciding whether to keep reading. And `shown` has to flip
      on a later frame regardless: set in the same tick as the mount, the
      element would render already in its final state and there would be
      nothing to transition from.
    */
    const enter = setTimeout(() => setShown(true), 700);
    return () => clearTimeout(enter);
  }, []);

  /* Animates out, then unmounts - so the banner leaves the way it arrived
     instead of blinking out of existence the instant a button is pressed. */
  const dismiss = useCallback(() => {
    setShown(false);
    setTimeout(() => setMounted(false), TRANSITION_MS);
  }, []);

  if (!mounted) return null;

  const accept = () => {
    setConsent('accepted');
    /*
      Start them here rather than waiting for a reload. Someone who accepts
      and then signs up in the same visit should be measured on that visit -
      otherwise the conversion that consent was asked for goes uncounted.
    */
    initAnalytics();
    initProductAnalytics();
    dismiss();
  };

  const decline = () => {
    setConsent('rejected');
    dismiss();
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      /*
        Above the bottom of a phone screen, not on it.

        Paywalls pin their CTA to the bottom on mobile (fixed bottom-0,
        z-40) and this banner is fixed bottom-0 z-50, so the two occupied
        the same strip and the banner won. Unlike a button in normal flow,
        a pinned one never scrolls out from under it: the button that takes
        the money was unreachable until consent was answered, on the one
        screen where that costs something.

        Lifted clear on mobile rather than restacked, because a z-index war
        just moves the problem - putting the CTA on top would bury the
        Accept button instead, and consent has to stay answerable. Desktop
        keeps bottom-0; nothing is pinned down there.
      */
      className="fixed inset-x-0 bottom-[96px] sm:bottom-0 z-50 p-3 sm:p-5"
    >
      {/*
        Slides up and fades in, 320ms on a gentle ease-out. Small on purpose:
        a consent banner that makes an entrance is reading the room wrong.

        motion-reduce drops the movement and the fade together - a user who
        has asked for less motion gets the banner simply present, which is the
        correct resting state anyway.
      */}
      <div
        className={`mx-auto max-w-3xl rounded-2xl border border-white/10 bg-brand-surface/95
          backdrop-blur-md p-4 sm:p-5 shadow-2xl
          transition-all duration-[320ms] ease-out
          motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100
          ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
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

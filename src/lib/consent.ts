/*
  Whether this visitor has agreed to analytics cookies.

  Google Analytics and PostHog both loaded on every visit with nothing asked
  first. The Privacy Policy described cookies we set, and there was no way for
  anyone to say no to them - only a hidden opt-out key that defaulted to
  tracking, which is the opposite of consent.

  Under GDPR and the ePrivacy rules, analytics and session recording are not
  "strictly necessary", so they need a yes BEFORE they run, not a notice
  afterwards. PostHog session recording makes that sharper than usual: it
  replays what someone did on the page.

  So nothing starts until this says accepted. A visitor who ignores the
  banner is never tracked, which is the correct default and also the honest
  reading of silence.
*/

const CONSENT_KEY = 'tradex_cookie_consent';

export type ConsentState = 'accepted' | 'rejected' | 'unset';

export function getConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw === 'accepted' || raw === 'rejected' ? raw : 'unset';
  } catch {
    /*
      Private mode, or storage blocked. Treat it as no answer given: the
      banner shows again next visit, and nothing is tracked meanwhile.
      Failing closed is the only safe direction here.
    */
    return 'unset';
  }
}

export function setConsent(state: 'accepted' | 'rejected'): void {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // Nothing to do - the choice applies for this page view either way.
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === 'accepted';
}

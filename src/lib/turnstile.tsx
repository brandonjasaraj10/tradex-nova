import { useCallback, useEffect, useRef } from 'react';

/*
  Cloudflare Turnstile: proof that a real person is signing up or signing in.

  Signup used to have nothing in front of it, and every account can spend real
  money on Nova before paying, so a script making accounts is a real cost.
  Supabase checks the token itself once CAPTCHA is on in its dashboard.

  ORDER MATTERS WHEN TURNING IT ON. Ship this first: while CAPTCHA is off
  Supabase ignores the token, so nothing changes for anybody. Switching it on
  before this is live would refuse every signup and sign-in on the site.

  Mostly invisible. appearance 'interaction-only' draws nothing unless
  Cloudflare actually needs the person to do something.

  No site key means no widget and no token, so a preview or local build without
  the key behaves exactly as it did before.
*/

const SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/* Long enough for somebody to answer a challenge if one appears. */
const TOKEN_WAIT_MS = 20_000;

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      /* Cleared so the next page that needs it can try again. */
      scriptLoading = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

/* Supabase's words when it refuses a missing or failed token. */
export function isCaptchaError(err: unknown): boolean {
  return err instanceof Error && /captcha/i.test(err.message);
}

export const CAPTCHA_ERROR_MESSAGE =
  'We couldn’t confirm you’re a real person. Reload the page and try again, or turn off any ad blocker.';

export function useTurnstile(enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  /* Anybody waiting on a token, released when one arrives or the widget fails. */
  const waitersRef = useRef<((token: string | undefined) => void)[]>([]);

  const settle = useCallback((token: string | undefined) => {
    tokenRef.current = token ?? null;
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((release) => release(token));
  }, []);

  useEffect(() => {
    if (!SITE_KEY || !enabled) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          theme: 'dark',
          callback: (token: string) => settle(token),
          'expired-callback': () => { tokenRef.current = null; },
          'error-callback': () => {
            settle(undefined);
            /* Handled here, so Turnstile does not also throw it at the page. */
            return true;
          },
        });
      })
      .catch(() => settle(undefined));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      tokenRef.current = null;
    };
  }, [enabled, settle]);

  /*
    Undefined when there is no token to give: no key, or it never arrived. The
    request still goes out, because whether that is acceptable is Supabase's
    decision, and blocking here would lock people out while CAPTCHA is off.
  */
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!SITE_KEY || !enabled) return Promise.resolve(undefined);
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    return new Promise((resolve) => {
      const release = (token: string | undefined) => {
        clearTimeout(timer);
        resolve(token);
      };
      const timer = setTimeout(() => {
        waitersRef.current = waitersRef.current.filter((w) => w !== release);
        resolve(undefined);
      }, TOKEN_WAIT_MS);
      waitersRef.current.push(release);
    });
  }, [enabled]);

  /* A token works once, so a wrong password needs a fresh one for the retry. */
  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, getToken, reset };
}

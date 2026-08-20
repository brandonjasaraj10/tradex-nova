import { lazy, type ComponentType } from 'react';

const FLAG_PREFIX = 'tradex:chunk-reload:';

// sessionStorage throws in some privacy/embedded-browser modes (Instagram's
// in-app browser among them), and this whole helper exists to make those
// browsers work - so never let the guard itself be the thing that breaks.
function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    // no-op: worst case we lose the loop guard, which is handled below by
    // only ever reloading when the flag was successfully absent.
  }
}

/**
 * Lazy-load a route, surviving a deploy that happened while the page was open.
 *
 * The app is code-split, so each page is a separate hashed file
 * (Sales-NnFzlO8R.js). A deploy publishes new hashes and drops the old files.
 * Anyone still running the previous index.html then asks for a filename that
 * no longer exists and gets "Failed to fetch dynamically imported module" -
 * which is exactly what Sentry caught in production on 2026-08-20, from an
 * Instagram in-app browser that had kept the page alive across a deploy.
 *
 * Recovery: retry once for an ordinary network blip, then fall back to a
 * single hard reload, which pulls the current index.html and its valid chunk
 * names. The sessionStorage flag makes sure a genuinely broken chunk can't
 * put the browser in a reload loop - second time through, we rethrow and let
 * the error boundary render.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  name: string,
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const flag = FLAG_PREFIX + name;

    try {
      const mod = await factory();
      writeFlag(flag, false);
      return mod;
    } catch {
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        const mod = await factory();
        writeFlag(flag, false);
        return mod;
      } catch (retryError) {
        if (!readFlag(flag)) {
          writeFlag(flag, true);
          window.location.reload();
          // Never resolves - the reload replaces this document.
          return new Promise<never>(() => {});
        }
        throw retryError;
      }
    }
  });
}

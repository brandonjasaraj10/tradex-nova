import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/*
  Start a new page at the top.

  The browser only loads one document in a single-page app, so it never gets
  the chance to reset the scroll position the way a normal link does. Clicking
  from the bottom of the FAQ through to Pricing landed you two thirds of the
  way down Pricing, looking at whatever happened to occupy that many pixels.

  Three cases, deliberately treated differently:

  - A normal navigation (PUSH/REPLACE) goes to the top. That is what a link
    does everywhere else on the web.

  - A navigation carrying a hash does NOT, because the whole point of
    /faq#safety is to land on that section. The element may not exist on the
    first frame - the route is lazily loaded - so it is looked up after paint
    and, failing that, left to the browser.

  - Back and forward (POP) are left alone. Sending someone to the top of a
    page they are returning to throws away the position they were reading at,
    which is the one thing the back button is supposed to preserve.

  'instant' rather than smooth on purpose: a page change is not a scroll, and
  animating one makes arriving somewhere new feel like a glitch. It also
  respects nobody's reduced-motion setting if it animates.
*/
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;

    if (hash) {
      /*
        After paint, so a lazily-loaded route has had a chance to render the
        target. scroll-mt on the headings handles clearing the sticky header.
      */
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView();
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash, navigationType]);

  return null;
}

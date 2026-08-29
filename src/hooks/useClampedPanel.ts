import { RefObject, useLayoutEffect, useState } from 'react';

/*
  Keeps a dropdown panel on screen, and returns the horizontal nudge needed.

  These panels are anchored to their trigger button, which is fine until the
  trigger is not near the edge it is anchored to. The date range trigger is the
  clearest case: its label is the selected dates, so the button changes width
  whenever a different range is picked, and every control after it shifts. On a
  narrow screen the panel then hung off the right edge - and it moved depending
  on which dates were selected, which is exactly how it looked.

  Rather than picking a left or right anchor per breakpoint - neither is right
  at every trigger position, which is what kept breaking - this works out where
  the panel actually lands and nudges it back inside the gutters.

  Two details worth keeping:

  - The measurement uses offsetLeft/offsetWidth rather than
    getBoundingClientRect. These panels animate in with a scale, so their
    rendered rect is briefly 95% of the real size, and measuring that would
    under-read the overflow. Layout values ignore transforms entirely.
  - The result is handed to framer-motion as `x`, not written to
    style.transform, because motion owns the transform property on these
    elements and overwrites anything set underneath it.

  When nothing overflows the shift is 0 and the panel sits exactly where it
  always did, so wider screens are untouched.
*/

const GUTTER = 16;

export function useClampedPanel(
  isOpen: boolean,
  wrapperRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>
): number {
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    if (!isOpen) {
      setShift(0);
      return;
    }

    const clamp = () => {
      const wrapper = wrapperRef.current;
      const panel = panelRef.current;
      if (!wrapper || !panel) return;

      // offsetLeft is relative to the wrapper (the offset parent), and neither
      // it nor offsetWidth is affected by the entrance animation's transform.
      const naturalLeft = wrapper.getBoundingClientRect().left + panel.offsetLeft;
      const naturalRight = naturalLeft + panel.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;

      let next = 0;
      if (naturalRight > viewportWidth - GUTTER) {
        next = viewportWidth - GUTTER - naturalRight;
      }
      // Pulling it off the right edge must never push it off the left one.
      // Both panels cap their width at the viewport, so they always fit.
      if (naturalLeft + next < GUTTER) {
        next = GUTTER - naturalLeft;
      }

      setShift(next);
    };

    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [isOpen, wrapperRef, panelRef]);

  return shift;
}

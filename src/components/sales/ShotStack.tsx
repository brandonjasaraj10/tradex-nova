import { useRef, useState } from 'react';
import ProductShot, { type ShotZoom } from './ProductShot';

/*
  Three screenshots as a pile you flip through - the phone version of the
  "Afterwards" deck.

  WHY NOT THE SAME SWIPE DECK AS DESKTOP

  On a phone the deck showed each desktop screenshot at 86% of the screen,
  one at a time, and that is the "text, picture, text, picture" rhythm
  Brandon wanted gone: a calendar shrunk to 290px is a grid of specks. A pile
  says "there are three of these" before anybody touches it, because the two
  behind peek out over the top, and each one carries a zoom on the number
  that screen is about, cut from the same image. See ProductShot.

  Tap the pile or swipe it to bring the next one forward; the labels under it
  jump straight to one. The page still scrolls vertically through it -
  touch-action pan-y hands vertical drags back to the browser.

  Phone only. Desktop keeps the swipe deck, untouched.
*/

export type StackShot = {
  id: string;
  label: string;
  src: string;
  alt: string;
  window: string;
  /* Optional - a screen that reads fine shrunk does not need one. */
  zoom?: ShotZoom;
};

const PEEK = 13; /* px each card behind shows above the one in front */

export default function ShotStack({ shots, className = '' }: { shots: StackShot[]; className?: string }) {
  const [active, setActive] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = shots.length;

  /*
    One move, not two.

    The first version flicked the front card off to the left, waited for it,
    then closed the pile up - and the flicked card then slid all the way back
    in from the left to take its place at the back, fading as it went.
    Brandon's word for that on his phone was "glitching", and it was: two
    animations in sequence with a visible seam, plus a card crossing the
    whole pile. Now every card simply moves to its new place in the pile at
    once - the one in front drops behind, the next rises to meet you - and
    only transform and opacity change, which a phone can do on the GPU
    without repainting the screenshots.
  */
  /*
    And slowly. At 420ms with a fast-out curve the flip landed hard - Brandon:
    "scrolls a little too hard", not on theme for a page that is otherwise
    unhurried. It is now 750ms on a curve that eases in as well as out, and
    z-index transitions with everything else: z-index animates as a whole
    number, so the card leaving the front stays on top for the first part of
    the move, fading as the next one rises behind it, instead of vanishing
    behind it on the first frame.
  */
  const go = (next: number) => {
    if (next !== active) setActive(next);
  };

  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return; /* a scroll, not a flip */
    if (dx > 40) go((active - 1 + n) % n);
    else if (dx < -40 || Math.abs(dx) < 8) go((active + 1) % n);
  };

  return (
    <div className={className}>
      <div
        className="grid cursor-pointer select-none [touch-action:pan-y]"
        style={{ paddingTop: PEEK * (n - 1) }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={onUp}
        onPointerCancel={() => { start.current = null; }}
        role="group"
        aria-roledescription="carousel"
        aria-label="Calendar and reports screenshots"
      >
        {shots.map((s, i) => {
          const depth = (i - active + n) % n;
          return (
            <div
              key={s.id}
              aria-hidden={depth !== 0}
              className="[grid-area:1/1] origin-top [will-change:transform,opacity]
                transition-[transform,opacity,z-index] duration-[750ms] ease-[cubic-bezier(.45,0,.2,1)]
                motion-reduce:transition-none"
              style={{
                transform: `translate3d(0, ${-depth * PEEK}px, 0) scale(${1 - depth * 0.06})`,
                opacity: depth === 0 ? 1 : depth === 1 ? 0.55 : 0.28,
                zIndex: 30 - depth * 10,
              }}
            >
              <ProductShot
                src={s.src}
                label={s.window}
                alt={s.alt}
                zooms={s.zoom ? [s.zoom] : undefined}
                zoomSpace="mb-12"
                zoomsVisible={depth === 0}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="relative h-[2px] rounded-full bg-white/[0.08]" style={{ width: `${n * 66}px` }}>
          <span
            className="absolute inset-y-0 rounded-full bg-white/60 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${100 / n}%`, transform: `translateX(${active * 100}%)` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {shots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-current={active === i}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors duration-300 ${
                active === i ? 'text-gray-200' : 'text-gray-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

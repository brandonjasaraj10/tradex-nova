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
  const [leaving, setLeaving] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = shots.length;

  const go = (next: number) => {
    if (leaving !== null || next === active) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setActive(next); return; }
    /*
      The front card flicks off to the side first, then the pile closes up.
      Sending it straight to the back made it shrink in place behind the next
      one, which read as the image breaking rather than as a card moving.
    */
    setLeaving(active);
    window.setTimeout(() => {
      setActive(next);
      setLeaving(null);
    }, 260);
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
          const isLeaving = leaving === i;
          const transform = isLeaving
            ? 'translateX(-112%) rotate(-7deg)'
            : `translateY(${-depth * PEEK}px) scale(${1 - depth * 0.06})`;
          return (
            <div
              key={s.id}
              aria-hidden={depth !== 0}
              className="[grid-area:1/1] origin-top transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]
                motion-reduce:transition-none"
              style={{
                transform,
                opacity: isLeaving ? 0 : depth === 0 ? 1 : depth === 1 ? 0.55 : 0.28,
                zIndex: isLeaving ? 40 : 30 - depth * 10,
                transitionDuration: isLeaving ? '260ms' : undefined,
              }}
            >
              <ProductShot
                src={s.src}
                label={s.window}
                alt={s.alt}
                zooms={s.zoom ? [s.zoom] : undefined}
                zoomSpace="mb-12"
                zoomsVisible={depth === 0 && !isLeaving}
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

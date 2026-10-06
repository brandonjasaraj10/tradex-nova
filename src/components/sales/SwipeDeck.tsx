import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';

/*
  A horizontal deck of panels, centred, with a rail underneath.

  Lifted out of the psychology section once a second section needed the same
  behaviour. Everything awkward about it was learned there and is worth
  keeping written down, because all three are easy to get wrong again:

  SPACERS, NOT PADDING. The first and last panel have nothing to centre
  against - one sits at scroll position zero, the other at maximum scroll - so
  without something to offset them, whichever you are looking at appears cut
  off against an edge. Padding the track does not work: a percentage width on
  a flex child resolves against the container's CONTENT box, so padding
  shrinks the box the panels are sized from and they come out narrower than
  asked for, still off centre. The spacers are content, so the panels keep
  their full width. Each is SIDE minus one gap, because the flex gap applies
  between a spacer and its neighbour too.

  ONE SOURCE OF TRUTH FOR THE INDEX. A button press sets the index and starts
  a smooth scroll; the scroll listener then recomputes the index from a
  scrollLeft that has not moved yet and sets it back, and the animation
  carries it forward again. That flicker is visible as the panels dim. The
  listener is locked out until the programmatic scroll arrives, with a
  timeout so the lock cannot stick if the scroll lands a pixel off.

  NO EDGE MASK. Fading the outer few percent of the track sounds right and is
  wrong: once the panels are centred, that is exactly where the ACTIVE panel's
  own edge sits, so the softening dims the thing being read. The neighbours
  already recede by opacity.
*/

const PANEL_W = 86;              /* percent of the track */
const SIDE = (100 - PANEL_W) / 2;
const GAP = 24;                  /* px - must match the gap class below */

export type DeckPanel = {
  id: string;
  /* Named on the rail, so somebody can see where they would be going. */
  label: string;
  content: ReactNode;
};

export default function SwipeDeck({
  panels,
  equalHeight = true,
}: {
  panels: DeckPanel[];
  /*
    Equal height stops the rail and everything below it jumping as panels
    change. Turn it off when the panels are images of different aspect
    ratios, where matching heights leaves one of them letterboxed.

    Never applied below sm. On a phone the shorter panel was stretched to the
    taller one's height, and at 390px wide that meant a card that was mostly
    empty space around three rows of dots. The track still takes the tallest
    panel's height either way, so the rail underneath does not jump - all
    that changes is whether the slack sits inside the card or below it, and
    below it is the version that does not look unfinished.
  */
  equalHeight?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const animatingTo = useRef<number | null>(null);

  /*
    ON A PHONE, THE TRACK IS AS TALL AS THE PANEL YOU ARE LOOKING AT.

    A flex row is as tall as its tallest child, so a short panel next to a
    tall one sat above a band of empty space - ~180px of nothing between the
    psychology card and the rail at 390px, which on a phone is a fifth of the
    screen. Stretching the short card to fill it was worse: a card that was
    mostly empty.

    So below sm the track's height follows the active panel and animates
    between them as you swipe. The rail moves with it, smoothly, which is the
    cost - and on a phone it is a better cost than a fifth of the screen
    standing empty. From sm up nothing here applies: no inline height, and the
    layout is exactly what it was.
  */
  const [heights, setHeights] = useState<number[]>([]);
  /*
    The panels currently on screen, as a range - [0, 0] at rest on the first,
    [0, 1] anywhere between the first and second.

    The track is as tall as the tallest panel in that range. So the moment a
    swipe brings a taller panel into view the track is already tall enough
    for it, and it only shrinks back once the swipe has landed on a shorter
    one. The previous version sized it from the panel the swipe had settled
    on, which meant the incoming panel slid in cropped at the bottom and then
    the page jumped down to fit it once the swipe stopped - what Brandon saw
    on his phone.
  */
  const [span, setSpan] = useState<[number, number]>([0, 0]);
  const spanRef = useRef(span);
  spanRef.current = span;
  const isPhoneRef = useRef(false);
  const lastHeight = useRef(0);
  const [isPhone, setIsPhone] = useState(false);
  isPhoneRef.current = isPhone;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const panels = [...el.querySelectorAll<HTMLElement>('[data-panel]')];
    const measure = () => {
      const hs = panels.map((p) => p.offsetHeight);
      /*
        A panel that just grew gets its room in this same frame, written
        straight onto the track, before React has re-rendered.

        Going through state alone was one frame late, and the score
        breakdown opens by animating its own height - about 50px a frame -
        so one frame late was 50 to 80px of the breakdown cropped off the
        bottom on every frame of its opening. A ResizeObserver callback runs
        after layout and before paint, so writing here lands before anybody
        sees the crop. The render that follows sets the same value.
      */
      if (isPhoneRef.current) {
        const [lo, hi] = spanRef.current;
        const need = Math.max(0, ...hs.slice(lo, hi + 1));
        if (need > el.offsetHeight) {
          el.style.transition = 'none';
          el.style.height = `${need}px`;
          lastHeight.current = need;
        }
      }
      setHeights(hs);
    };
    measure();
    const ro = new ResizeObserver(measure);
    panels.forEach((p) => ro.observe(p));
    return () => ro.disconnect();
  }, [panels.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = el.querySelector<HTMLElement>('[data-panel]');
        const step = panel ? panel.offsetWidth + GAP : el.clientWidth;
        const pos = Math.min(panels.length - 1, el.scrollLeft / Math.max(1, step));
        /* Within a few per cent of a panel counts as on it - snapping lands a pixel or two off. */
        const near = Math.round(pos);
        setSpan((prev) => {
          const next: [number, number] =
            Math.abs(pos - near) < 0.03 ? [near, near] : [Math.floor(pos), Math.ceil(pos)];
          return prev[0] === next[0] && prev[1] === next[1] ? prev : next;
        });
        const at = near;
        if (animatingTo.current !== null) {
          if (at === animatingTo.current) animatingTo.current = null;
          return;
        }
        setIndex(at);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [panels.length]);

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const panel = el.querySelector<HTMLElement>('[data-panel]');
    const step = panel ? panel.offsetWidth + GAP : el.clientWidth;
    const target = Math.min(i * step, el.scrollWidth - el.clientWidth);
    animatingTo.current = i;
    setIndex(i);
    /* Both ends of the trip are on screen from the first frame of it. */
    const here = Math.round(el.scrollLeft / Math.max(1, step));
    setSpan([Math.min(here, i), Math.max(here, i)]);

    /*
      Snapping off for the trip, back on once it has arrived.

      A smooth programmatic scroll into a mandatory snap container is where
      Safari overshoots and then bounces back to the snap point - the "goes
      too far and comes back to the middle" reported from an iPhone. With
      snapping suspended there is nothing to bounce against; the scroll just
      stops where it was sent, which is already the snap point.
    */
    el.style.scrollSnapType = 'none';

    /*
      The slide is animated here, frame by frame, rather than handed to
      scrollTo({ behavior: 'smooth' }) - because that call does not behave the
      same in any two browsers once scroll-snap is involved. Measured: in
      Chrome's phone emulation a smooth scrollTo on this track did nothing at
      all (an instant one moved it fine), and on a real iPhone the same call
      ran, overshot, and bounced back. Driving scrollLeft directly with an
      ease-out curve is identical everywhere and has nothing to overshoot.
    */
    const from = el.scrollLeft;
    const distance = target - from;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 420;
    const began = performance.now();
    const finish = () => {
      el.scrollLeft = target;
      el.style.scrollSnapType = '';
      animatingTo.current = null;
      setSpan([i, i]);
    };
    if (duration === 0 || Math.abs(distance) < 1) { finish(); return; }
    const frame = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.scrollLeft = from + distance * eased;
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
  };

  const trackHeight = isPhone
    ? Math.max(0, ...heights.slice(span[0], span[1] + 1).filter(Boolean))
    : 0;
  const growing = trackHeight >= lastHeight.current;
  useLayoutEffect(() => {
    lastHeight.current = trackHeight;
  });

  const spacer = (
    <span
      aria-hidden="true"
      className="flex-shrink-0"
      style={{ flexBasis: `calc(${SIDE}% - ${GAP}px)` }}
    />
  );

  return (
    <div>
      <div
        ref={trackRef}
        className={`flex gap-6 overflow-x-auto snap-x snap-mandatory
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          max-sm:items-start max-sm:overflow-y-hidden
          ${equalHeight ? '' : 'items-start'}`}
        style={
          trackHeight
            ? {
                height: trackHeight,
                /*
                  Growing is instant, shrinking is animated. A panel that
                  grows - the score breakdown opening, or a taller panel
                  sliding in - has to have the room the same frame it needs
                  it; animating towards it is what left the breakdown cropped
                  and lagging behind its own expand. Shrinking has nothing to
                  crop, so it can take its time.
                */
                transition: growing ? 'none' : 'height 300ms ease-out',
              }
            : undefined
        }
      >
        {spacer}
        {panels.map((p, i) => (
          <div
            key={p.id}
            data-panel
            style={{ width: `${PANEL_W}%` }}
            className={`flex-shrink-0 snap-center transition-[opacity,transform] duration-500 ease-out
              motion-reduce:transition-none ${
                index === i
                  ? 'opacity-100 scale-100'
                  : 'opacity-45 scale-[0.975] motion-reduce:scale-100'
              }`}
          >
            {p.content}
          </div>
        ))}
        {spacer}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div
          className="relative h-[2px] rounded-full bg-white/[0.08]"
          style={{ width: `${Math.max(2, panels.length) * 66}px` }}
        >
          <span
            className="absolute inset-y-0 rounded-full bg-white/60 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${100 / panels.length}%`, transform: `translateX(${index * 100}%)` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {panels.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(i)}
              aria-current={index === i}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors duration-300 ${
                index === i ? 'text-gray-200' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

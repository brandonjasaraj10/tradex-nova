import { useState, useRef, useEffect, type ReactNode } from 'react';

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
  const [isPhone, setIsPhone] = useState(false);

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
    const measure = () => setHeights(panels.map((p) => p.offsetHeight));
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
        const at = Math.min(panels.length - 1, Math.round(el.scrollLeft / Math.max(1, step)));
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
    animatingTo.current = i;
    setIndex(i);
    el.scrollTo({ left: i * step, behavior: 'smooth' });
    window.setTimeout(() => { animatingTo.current = null; }, 700);
  };

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
        className={`flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          max-sm:items-start max-sm:overflow-y-hidden max-sm:transition-[height] max-sm:duration-300 max-sm:ease-out
          ${equalHeight ? '' : 'items-start'}`}
        style={isPhone && heights[index] ? { height: heights[index] } : undefined}
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

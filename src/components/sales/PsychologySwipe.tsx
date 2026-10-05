import { useState, useRef, useEffect, useCallback } from 'react';
import PreTradeScales, { type ScaleValues } from '../journal/PreTradeScales';
import NOVAScore from '../shared/NOVAScore';
import { EXAMPLE_SCORE } from '../marketing/exampleScore';

/*
  The psychology section, as two panels you move between.

  WHAT THE FIRST VERSION GOT WRONG

  It worked and it looked like a prototype. Two full-width boxes butted
  against each other with a one-pixel gutter, and two grey chip buttons
  underneath. Nothing told you there was a second panel until you had already
  found it, nothing moved except the scroll position, and the whole thing read
  as a mechanism rather than as a designed object.

  Four changes, and they are all about the same thing - making the movement
  itself feel deliberate:

  1. THE PANELS PEEK. Each is slightly narrower than the track, so the edge of
     the next one is always visible. That is the entire reason anybody swipes
     a carousel: not a dot telling them they could, but seeing that there is
     something there. It also means the gap between panels is a real gap you
     watch pass, rather than two borders touching.

  2. THE INACTIVE PANEL SITS BACK. Dimmed and very slightly scaled down, with
     a slow transition. Depth is what separates a carousel from a row of
     boxes, and it costs two CSS properties.

  3. THE EDGES FADE. The track is masked at both ends so a panel arrives and
     leaves rather than being clipped against a hard edge.

  4. THE INDICATOR IS A RAIL, NOT TWO BUTTONS. A thin track with a thumb that
     slides between two positions, labelled. It says where you are, where you
     could go, and that the two are a sequence - which is the actual argument
     of the section: one thing becomes the other.

  THE DOTS WORK

  Unchanged and worth restating: the scales are the app's own component with
  its real onChange wired to local state. Tap a dot and it sets, tap the one
  already set and it clears. It is the only thing on this page a visitor can
  use before signing up, and it costs nothing - no account, no API call,
  nothing leaving the page.

  prefers-reduced-motion removes the scaling and the smooth scrolling; the
  panels and the rail still work, they just stop animating.
*/

const PANELS = [
  { id: 'before', eyebrow: 'Before the trade', label: 'What you put in' },
  { id: 'after', eyebrow: 'After thirty of them', label: 'What comes out' },
] as const;

export default function PsychologySwipe() {
  /*
    Starts two-of-three answered. Empty reads as a broken control, full leaves
    nothing to do, and the missing one is an invitation.
  */
  const [values, setValues] = useState<ScaleValues>({
    emotional_state: 2,
    focus: 4,
    confidence: null,
  });
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const onChange = useCallback((key: keyof ScaleValues, value: number | null) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = el.firstElementChild as HTMLElement | null;
        const step = panel ? panel.offsetWidth + 24 : el.clientWidth;
        setIndex(Math.min(PANELS.length - 1, Math.round(el.scrollLeft / Math.max(1, step))));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const panel = el.firstElementChild as HTMLElement | null;
    const step = panel ? panel.offsetWidth + 24 : el.clientWidth;
    el.scrollTo({ left: i * step, behavior: 'smooth' });
    setIndex(i);
  };

  const panelClass = (i: number) =>
    `w-[86%] sm:w-[91%] flex-shrink-0 snap-center transition-[opacity,transform] duration-500 ease-out
     motion-reduce:transition-none ${
       index === i
         ? 'opacity-100 scale-100'
         : 'opacity-45 scale-[0.975] motion-reduce:scale-100'
     }`;

  /*
    Equal height, because a carousel whose panels change height makes the rail
    and everything under it jump as you move. The second panel is the taller
    one, so the first has slack - centring the body means that slack sits
    above and below the content rather than pooling at the bottom and reading
    as an unfinished box.
  */
  const card =
    'h-full flex flex-col rounded-[20px] border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent p-6 sm:p-9';

  return (
    <div>
      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          /* A panel arrives and leaves rather than being cut off at the edge. */
          maskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)',
        }}
      >
        <div className={panelClass(0)}>
          <div className={card}>
            <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
              {PANELS[0].eyebrow}
            </p>
            <div className="flex-1 flex items-center py-7">
              <div className="w-full">
                <PreTradeScales accent="marketing" values={values} onChange={onChange} />
              </div>
            </div>
            <p className="text-[12.5px] leading-relaxed text-gray-500 max-w-sm">
              Go on, set them. Three taps, and they are the only thing TradeX
              asks you for that your broker cannot tell it.
            </p>
          </div>
        </div>

        <div className={panelClass(1)}>
          <div className={card}>
            <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
              {PANELS[1].eyebrow}
            </p>
            <div className="flex-1 flex items-center py-7">
              <div className="w-full">
              <NOVAScore
                accent="marketing"
                breakdown={EXAMPLE_SCORE}
                size="md"
                showBreakdown
                periodLabel="Last 30 days"
              />
              </div>
            </div>
            <p className="text-[12.5px] leading-relaxed text-gray-500 max-w-sm">
              One number, built from how you traded rather than from what the
              market did. Example figures.
            </p>
          </div>
        </div>
      </div>

      {/*
        The rail. Two segments, a thumb that slides, and the label of wherever
        you are sitting underneath it - so the control says both where you are
        and that there is somewhere else to be.
      */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="relative h-[2px] w-[132px] rounded-full bg-white/[0.08]">
          <span
            className="absolute inset-y-0 w-1/2 rounded-full bg-white/60 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center gap-1">
          {PANELS.map((p, i) => (
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

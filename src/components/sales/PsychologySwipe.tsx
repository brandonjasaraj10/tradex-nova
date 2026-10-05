import { useState, useRef, useEffect, useCallback } from 'react';
import PreTradeScales, { type ScaleValues } from '../journal/PreTradeScales';
import NOVAScore from '../shared/NOVAScore';
import { EXAMPLE_SCORE } from '../marketing/exampleScore';

/*
  The psychology section, as two panels you move between rather than one
  column you scroll past.

  WHAT THIS REPLACES

  Everything stacked: the three pre-trade scales, then the NOVA Score with its
  breakdown open, then a "what it found" claim, then a mascot on top of the
  lot. Four things competing in one box, and the section's actual argument -
  you rate your head, and a number moves - was the first casualty.

  Two panels now. The first is what you put in. The second is what comes out
  of it. That is the whole section, and splitting it means each half gets to
  be the only thing on screen.

  THE DOTS WORK

  The scales were rendered `disabled` with fixed values, which is a picture of
  a control. They are live here: tap a dot and it sets, tap the one already
  set and it clears, exactly as it behaves in the app, because it IS the
  app's component with its real onChange wired to local state.

  It is the only thing on this page somebody can actually use before signing
  up, and it costs nothing - no account, no API call, no data leaving the
  page. A visitor who has rated their own state on the real control has used
  more of the product than one who read four more paragraphs about it.

  WHY SCROLL-SNAP AND NOT A CAROUSEL

  The page already contains a hand-written swipe carousel with axis locking
  and drag resistance. This needs none of it: two panels, native horizontal
  scrolling with snap points, which a trackpad, a touchscreen, a scrollbar and
  the keyboard all drive for free and which no JavaScript has to keep upright.
  The buttons below are for pointer users who will not think to swipe.
*/

const PANELS = [
  { id: 'before', label: 'Before the trade' },
  { id: 'after', label: 'What it turns into' },
] as const;

export default function PsychologySwipe() {
  /*
    Starts part-answered rather than blank. An empty set of dots reads as a
    broken control, and a full set leaves nothing to do - two of three invites
    the third.
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

  /* Keep the indicator honest when the panel is moved by scrolling, not by the buttons. */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
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
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIndex(i);
  };

  return (
    <div>
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Panel one: the input. */}
        <div className="w-full flex-shrink-0 snap-center px-[1px]">
          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-8">
            <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-5">
              Before the trade
            </p>
            <PreTradeScales
              accent="marketing"
              values={values}
              onChange={onChange}
            />
            <p className="mt-6 text-[12.5px] text-gray-500">
              Go on, set them. Three taps, and they are the only thing TradeX
              asks you for that your broker cannot tell it.
            </p>
          </div>
        </div>

        {/* Panel two: what it becomes. */}
        <div className="w-full flex-shrink-0 snap-center px-[1px]">
          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-8">
            <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-5">
              After thirty of them
            </p>
            <NOVAScore
              accent="marketing"
              breakdown={EXAMPLE_SCORE}
              size="md"
              showBreakdown
              periodLabel="Last 30 days"
            />
            <p className="mt-6 text-[12.5px] text-gray-500">
              One number, built from how you traded rather than what the market
              did. Example figures.
            </p>
          </div>
        </div>
      </div>

      {/*
        Labelled buttons rather than anonymous dots: two panels is few enough
        that naming them costs nothing and tells somebody what they would be
        moving to, which a dot never does.
      */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {PANELS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(i)}
            aria-current={index === i}
            className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
              index === i
                ? 'bg-white/[0.07] text-gray-200'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

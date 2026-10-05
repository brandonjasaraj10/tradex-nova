import { useState, useCallback } from 'react';
import PreTradeScales, { type ScaleValues } from '../journal/PreTradeScales';
import NOVAScore from '../shared/NOVAScore';
import { EXAMPLE_SCORE } from '../marketing/exampleScore';
import SwipeDeck from './SwipeDeck';

/*
  The psychology section: what you put in, and what comes out of it.

  The deck mechanics moved to SwipeDeck once a second section needed them -
  the spacer centring, the index locking and the reasons for both are
  documented there. What stays here is the part specific to this section, and
  it is the part that matters:

  THE DOTS WORK. The scales were rendered `disabled` with fixed values, which
  is a picture of a control. They are the app's own component with its real
  onChange wired to local state: tap a dot and it sets, tap the one already
  set and it clears, exactly as in the product. It is the only thing on this
  page a visitor can use before signing up, and it costs nothing - no account,
  no API call, nothing leaving the page.
*/

const card =
  'h-full flex flex-col rounded-[20px] border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent p-6 sm:p-9';

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

  const onChange = useCallback((key: keyof ScaleValues, value: number | null) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  return (
    <SwipeDeck
      panels={[
        {
          id: 'before',
          label: 'What you put in',
          content: (
            <div className={card}>
              <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
                Before the trade
              </p>
              <div className="flex-1 flex items-center py-7">
                <div className="w-full">
                  <PreTradeScales accent="marketing" values={values} onChange={onChange} />
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed text-gray-500 max-w-sm">
                Three taps, before you click buy. Your broker can report the
                trade. It cannot report the state you took it in.
              </p>
            </div>
          ),
        },
        {
          id: 'after',
          label: 'What comes out',
          content: (
            <div className={card}>
              <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
                After thirty of them
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
          ),
        },
      ]}
    />
  );
}

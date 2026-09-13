import { useState, useEffect } from 'react';

/*
  What step 02 claims, shown happening: a rambling voice transcript resolving
  into filled-in fields.

  Two rules this follows that most typing animations do not.

  It never starts blank. The finished state is the resting state, so a link
  preview, a thumbnail, and a reader who arrives mid-scroll all see the point
  rather than an empty box waiting on a timer. The typing is an enhancement on
  top of a page that already reads correctly without it.

  And it respects prefers-reduced-motion by simply being finished. Nobody who
  has asked their machine to stop animating things needs to watch a caret.
*/

const TRANSCRIPT =
  'Shorted euro dollar half a lot, got stopped out for about a hundred and eighty bucks. Moved my stop twice again.';

const FIELDS: [string, string][] = [
  ['Symbol', 'EURUSD'],
  ['Direction', 'Short'],
  ['Size', '0.5 lots'],
  ['Result', '-$180'],
];

export default function TranscriptToEntry() {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Starts finished. The effect rewinds it only when animation is wanted.
  const [typed, setTyped] = useState(TRANSCRIPT.length);
  const [showFields, setShowFields] = useState(true);

  useEffect(() => {
    if (prefersReduced) return;

    /*
      No "have I already run" ref here, and that is the point.

      There used to be one, and it broke the whole thing in a way that only
      shows up in the browser: StrictMode double-invokes effects, so the first
      run set the flag and started the interval, the cleanup cleared the
      interval, and the second run hit the flag and returned early. The result
      was a caret blinking next to permanently empty text - reported from
      testing as "a blue thing that's about to type, but nothing's typing".

      Rewinding on every run is correct instead of merely tolerated: the
      cleanup cancels the previous pass, so a double-invoke just restarts it.
    */
    let i = 0;
    setTyped(0);
    setShowFields(false);

    const typing = setInterval(() => {
      i += 2;
      setTyped(i);
      if (i >= TRANSCRIPT.length) {
        clearInterval(typing);
        // A beat before the fields land, so the cause reads before the effect.
        reveal = setTimeout(() => setShowFields(true), 380);
      }
    }, 28);

    let reveal: ReturnType<typeof setTimeout>;

    return () => {
      clearInterval(typing);
      clearTimeout(reveal);
    };
  }, [prefersReduced]);

  const isTyping = typed < TRANSCRIPT.length;

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px] text-[10px] uppercase tracking-[0.12em] text-gray-600 flex-shrink-0">
          You
        </span>
        {/*
          min-h holds the lines the full transcript needs, so the fields below
          do not jump upward as the text grows.
        */}
        <p className="text-[12.5px] leading-relaxed text-gray-300 min-h-[4.2em] sm:min-h-[3.2em]">
          {TRANSCRIPT.slice(0, typed)}
          {isTyping && (
            <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-[1px] bg-brand-blue-light align-middle animate-pulse" />
          )}
        </p>
      </div>

      <div
        className={`mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[11.5px]
          transition-opacity duration-500 ${showFields ? 'opacity-100' : 'opacity-0'}`}
      >
        {FIELDS.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-white/[0.07] px-2.5 py-1.5"
          >
            <span className="text-gray-600">{k}</span>
            <span className="text-gray-300 tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

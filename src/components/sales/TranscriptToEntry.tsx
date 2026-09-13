import { useState, useEffect, useRef } from 'react';

/*
  What step 02 claims, shown happening: rambling speech resolving into a
  filled-in, formatted entry.

  Three rules, each learned from getting it wrong.

  It loops, and it plays when it comes INTO VIEW rather than on mount. Playing on mount meant it
  had always finished by the time anyone scrolled down to it - reported as
  "I don't see it anymore". The section sits well below the fold; an
  animation nobody is looking at has not run.

  It never rests blank. Before it has been seen, and after it has played, the
  finished state is what is on screen - so a link preview, a thumbnail and a
  reader who scrolls fast all get the point rather than an empty box.

  And prefers-reduced-motion simply gets the finished state.
*/

const TRANSCRIPT =
  'Shorted euro dollar half a lot, got stopped out for about a hundred and eighty bucks. Moved my stop twice again, same as Tuesday.';

const FIELDS: [string, string][] = [
  ['Symbol', 'EURUSD'],
  ['Direction', 'Short'],
  ['Size', '0.5 lots'],
  ['Result', '-$180'],
];

/*
  The organised output is a heading and bullets because that is what the app
  actually produces - Nova returns formatted HTML, not a flat sentence. Showing
  it as prose would undersell the part people are paying for.
*/
const BULLETS = [
  'Entered short on the retest, no confirmation',
  'Stop moved twice, both times against the plan',
  'Repeat of Tuesday - same setup, same mistake',
];

export default function TranscriptToEntry() {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [typed, setTyped] = useState(TRANSCRIPT.length);
  const [showEntry, setShowEntry] = useState(true);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const played = useRef(false);

  useEffect(() => {
    if (prefersReduced) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;

    let typing: ReturnType<typeof setInterval>;
    let reveal: ReturnType<typeof setTimeout>;
    let loop: ReturnType<typeof setTimeout>;

    const observer = new IntersectionObserver(
      (entries) => {
        /*
          Once only. Replaying every time it scrolls past would turn a
          demonstration into a distraction, and the second viewing tells
          nobody anything the first did not.
        */
        if (!entries[0].isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();

        /*
          Loops, because a single pass is easy to miss entirely - scroll past
          at the wrong moment and you get a finished panel and no idea it
          ever did anything. That was the report: "I can't see it anymore."

          The hold is long on purpose. Four seconds on the finished entry is
          most of the cycle, so what is on screen almost always is the
          result rather than the animation - the demonstration reads as a
          product panel that occasionally redraws itself, not a looping
          advert competing with the copy around it.
        */
        const run = () => {
          let i = 0;
          setTyped(0);
          setShowEntry(false);

          typing = setInterval(() => {
            i += 2;
            setTyped(i);
            if (i >= TRANSCRIPT.length) {
              clearInterval(typing);
              // A beat, so the cause reads before the effect.
              reveal = setTimeout(() => {
                setShowEntry(true);
                loop = setTimeout(run, 4200);
              }, 420);
            }
          }, 26);
        };

        run();
      },
      // Fires once the panel is properly on screen, not as its top edge grazes it.
      { threshold: 0.55 },
    );

    observer.observe(host);
    return () => {
      observer.disconnect();
      clearInterval(typing);
      clearTimeout(reveal);
      clearTimeout(loop);
    };
  }, [prefersReduced]);

  const isTyping = typed < TRANSCRIPT.length;

  return (
    <div ref={hostRef}>
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px] text-[10px] uppercase tracking-[0.12em] text-gray-600 flex-shrink-0">
          You
        </span>
        {/* min-h holds the full transcript's lines so nothing below jumps. */}
        <p className="text-[12.5px] leading-relaxed text-gray-300 min-h-[5.2em] sm:min-h-[3.4em]">
          {TRANSCRIPT.slice(0, typed)}
          {isTyping && (
            <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-[1px] bg-brand-blue-light align-middle animate-pulse" />
          )}
        </p>
      </div>

      <div
        className={`mt-3 pt-3 border-t border-white/[0.06] transition-opacity duration-500
          ${showEntry ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="grid grid-cols-2 gap-2 text-[11.5px]">
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

        <p className="mt-3.5 text-[10px] uppercase tracking-[0.12em] text-gray-600">What happened</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {BULLETS.map((b) => (
            <li key={b} className="flex gap-2 text-[12px] text-gray-400 leading-relaxed">
              <span className="text-gray-600 flex-shrink-0">&bull;</span>
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

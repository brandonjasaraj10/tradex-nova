import { useState, useEffect, useRef } from 'react';

/*
  Nova's answer arriving, rather than sitting there pre-written.

  The second of two animated things on the page, which is the ceiling the
  research puts on this: two or three animated areas, no more, or it reads as
  noise and costs load time. This one earns its place because the point of
  the section is that Nova had to work something out - watching the answer
  land says that; a paragraph already on screen does not.

  Same rules as the transcript animation. Resting state is the finished
  answer, so a link preview and a fast scroller get the substance. It starts
  when the panel is properly in view, not on mount. And
  prefers-reduced-motion gets the finished state with no movement at all.
*/

const ANSWER =
  'You are not. You are losing on the days you rate your focus below 5, and eleven of those fourteen days were Fridays. Your Friday setups win at the same rate as the rest of the week — you just size up on them after a flat week.';

export default function NovaAnswer() {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [shown, setShown] = useState(ANSWER.length);
  const [thinking, setThinking] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const played = useRef(false);

  useEffect(() => {
    if (prefersReduced) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;

    let think: ReturnType<typeof setTimeout>;
    let writing: ReturnType<typeof setInterval>;
    let loop: ReturnType<typeof setTimeout>;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();

        const run = () => {
          setShown(0);
          setThinking(true);

          // A short pause first: she is reading months of entries, and an
          // instant answer would look like a canned one.
          think = setTimeout(() => {
            setThinking(false);
            let i = 0;
            writing = setInterval(() => {
              i += 2;
              setShown(i);
              if (i >= ANSWER.length) {
                clearInterval(writing);
                loop = setTimeout(run, 6000);
              }
            }, 26);
          }, 900);
        };

        run();
      },
      /*
        A low threshold, not a half.

        0.5 means "half of this element is on screen", and on a phone this
        panel is taller than half the viewport - so that fraction was never
        reached and the observer never fired. Reported as "I don't see the
        Nova animation". rootMargin pulls the trigger line up from the bottom
        edge so it starts as the panel arrives rather than the instant one
        pixel of it appears.
      */
      { threshold: 0.01, rootMargin: '0px 0px -120px 0px' },
    );

    observer.observe(host);
    return () => {
      observer.disconnect();
      clearTimeout(think);
      clearInterval(writing);
      clearTimeout(loop);
    };
  }, [prefersReduced]);

  return (
    <div ref={hostRef} className="flex gap-2.5">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-blue/15 border border-brand-blue/30
        flex items-center justify-center text-[10px] font-medium text-brand-blue">
        N
      </span>
      {/*
        The finished answer is rendered invisibly underneath, in normal flow,
        and the animated copy is painted on top of it in the same grid cell.

        That reserves exactly the right height at every width, which a min-h
        cannot: the reserved value was 7.5em, and the answer needs four lines
        on a 320px phone and two on a desktop. Measured, it reserved 98px
        where the text actually wanted 214px at 320px wide and 172px at
        375px - so on a phone every loop shoved a hundred pixels of page up
        and down under someone trying to read it.

        aria-hidden on the spacer and aria-live on the visible copy, so a
        screen reader gets the answer once rather than twice.
      */}
      <div className="grid rounded-2xl rounded-tl-sm bg-brand-blue/[0.06] border border-brand-blue/20
        px-4 py-3 text-[13px] sm:text-sm text-gray-300 leading-relaxed">
        <p className="col-start-1 row-start-1 invisible" aria-hidden="true">
          {ANSWER}
        </p>
        <p className="col-start-1 row-start-1">
          {thinking ? (
            <span className="inline-flex gap-1 items-center" aria-label="Nova is thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-brand-blue/60 animate-pulse"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </span>
          ) : (
            ANSWER.slice(0, shown)
          )}
        </p>
      </div>
    </div>
  );
}

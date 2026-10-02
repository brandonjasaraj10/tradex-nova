/*
  The sync claim, in the hero, where every rival journal puts it.

  TradeZella and Tradespad both carry a moving row of the platforms they
  connect to above the fold, and it does two jobs at once: it answers "will
  this work with my account?" before anybody scrolls, and a row of names
  somebody recognises is the cheapest credibility on a page.

  NAMES, NOT LOGOS - AND THIS IS DELIBERATE

  The broker section further down already made this call and the reasoning
  holds here:

    - A logo wall reads as a partnership. There is no arrangement with any of
      these firms, and implying one to sell a subscription is a cheap claim
      and an expensive one to defend.
    - TradeX does not integrate with FTMO. It integrates with MT4 and MT5,
      which FTMO happens to run. Naming the platform as the thing that
      connects is both the honest version and the more useful one, because it
      covers every firm not on the list.
    - Ten sets of foreign brand colours would wreck a page whose entire
      visual argument is black, white and one blue.

  So the two platforms are stated as the claim, and the firms scroll past
  underneath as recognition rather than endorsement - which is what the
  wording has to carry: "works with", never "partnered with".

  THE MOTION

  Duplicated once and translated by exactly half, which is what makes the
  loop seamless rather than snapping back. Masked at both edges so names
  arrive and leave rather than being clipped. aria-hidden on the duplicate so
  a screen reader hears the list once.

  prefers-reduced-motion stops it dead and leaves a readable static row,
  because a permanently moving strip is a genuine accessibility problem and
  the row still does its job standing still.
*/

/* Not partners. Firms whose accounts run on the platforms TradeX connects to. */
const FIRMS = [
  'FTMO',
  'FundedNext',
  'The5ers',
  'FundingPips',
  'E8 Markets',
  'Alpha Capital',
  'FXIFY',
  'Goat Funded Trader',
  'Funded Trading Plus',
  'City Traders Imperium',
];

export default function SyncMarquee() {
  return (
    <div className="mt-7 w-full">
      <p className="text-center text-[11px] sm:text-[11.5px] text-gray-500">
        Syncs with{' '}
        <span className="text-gray-300">MetaTrader 4</span> and{' '}
        <span className="text-gray-300">MetaTrader 5</span>
        {' — '}so it works with
      </p>

      <div
        className="sync-marquee relative mt-3 overflow-hidden"
        style={{
          /*
            Fades both ends into the page background instead of cutting the
            names off at a hard edge.
          */
          maskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="sync-marquee-track flex w-max items-center gap-7 sm:gap-10">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex items-center gap-7 sm:gap-10"
            >
              {FIRMS.map((name) => (
                <span
                  key={name}
                  className="whitespace-nowrap text-[12px] sm:text-[13px] tracking-[0.02em] text-gray-600"
                >
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

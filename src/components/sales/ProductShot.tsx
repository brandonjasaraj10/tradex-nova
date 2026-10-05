/*
  A real screenshot of the app, in a window.

  WHY A SCREENSHOT AND NOT A DRAWING

  Every panel this replaces was hand-built HTML pretending to be TradeX, and
  each one had drifted from the product it was selling. The hero drew three
  statistics that exist nowhere, an equity curve with no data behind it, and a
  "Focus 4/10" tag - the app rates focus one to five. The pre-trade panel
  invented a Discipline slider the app has never had. These were not lies
  anybody told on purpose; they are what happens when a marketing page draws
  its own version of a product that then moves.

  A screenshot cannot drift silently. It goes stale, which is visible, rather
  than wrong, which is not.

  THE FIGURES IN THEM ARE A DEMO ACCOUNT

  Not a customer, and not a claim. Every shot carries a caption saying so,
  because a dark trading dashboard with a green number on it is exactly the
  image this industry uses to imply earnings, and we are not implying
  earnings. The account shown is up a few per cent over a month with eleven
  losing trades visible in the calendar - which is the honest picture and, as
  it happens, the more persuasive one for the person we are talking to.

  TWO CROPS, NOT ONE SHRUNK

  A 1600px desktop screenshot scaled into a 375px phone is 333px of unreadable
  mush - measured, not assumed. Most of this traffic arrives from Instagram on
  a phone, so that is the version most people would have seen.

  So each screen was shot twice: once at desktop width, and once on a 390px
  viewport scrolled to the part of the page that screen is actually about.
  <picture> hands the phone the phone crop. The mobile file is a third of the
  weight too, which is the right way round for the slower connection.

  LOADING

  The hero shot is the largest thing above the fold, so it loads eagerly and
  is marked high priority; everything below the fold loads lazily. Both carry
  explicit dimensions so the page does not jump as they arrive - most of this
  traffic is a phone on mobile data opening the page from Instagram.
*/

type Props = {
  /* The desktop shot. The phone crop is <name>-mobile.jpg beside it. */
  src: string;
  alt: string;
  /* The label in the window's title bar - the app's own page name. */
  label: string;
  /* Above the fold. Exactly one shot on the page should set this. */
  priority?: boolean;
  className?: string;
};

export default function ProductShot({ src, alt, label, priority = false, className = '' }: Props) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-brand-surface overflow-hidden
        shadow-[0_0_60px_-15px_rgba(255,255,255,0.08)] ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-brand-elevated">
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <span className="ml-2 text-[11px] text-gray-600 tracking-wide">{label}</span>
      </div>

      <picture>
        {/*
          The source carries its own dimensions, not just the img's.

          The two crops are different shapes - 1600x1000 against 780x1040 -
          and the aspect ratio a browser reserves before an image arrives
          comes from whichever element it took the image from. Without these,
          a phone reserved the wide box and then shoved the whole page down
          when the tall one landed.
        */}
        <source
          media="(max-width: 639px)"
          srcSet={src.replace(/\.jpg$/, '-mobile.jpg')}
          width={780}
          height={1040}
        />
        <img
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          {...(priority ? { fetchPriority: 'high' as const } : {})}
          className="block w-full h-auto"
        />
      </picture>
    </div>
  );
}

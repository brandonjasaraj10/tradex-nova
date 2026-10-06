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

  Not a customer, and not a claim. The hero used to carry a "demo account,
  not a customer's results" caption; Brandon took it off, judging that it
  raised a doubt nobody had. What keeps the shots honest instead is the
  numbers themselves: the account is up a few per cent with eleven losing
  trades visible in the calendar, which is a believable month rather than an
  earnings pitch - and keep it that way if these are ever reshot.

  ONE SCREENSHOT AT EVERY WIDTH, WITH A LENS ON A PHONE

  There used to be a second, phone-shaped crop of every screen. Brandon
  turned it down: a phone visitor should see the same desktop app everyone
  else sees, just smaller - the phone crop of the dashboard also showed the
  app's own phone header sitting on top of it, which looked like a glitch.

  The cost of shrinking a 1600px screenshot to a phone is that its text is
  too small to read. So below sm a shot can carry one or two ZOOMS: a small
  card cut from the very same image at a readable scale and laid over the
  edge of the window, pointing at the one part of that screen that matters.
  They are the same pixels, not a redrawing, so they cannot drift from the
  product any more than the screenshot can. Decorative, and hidden from
  screen readers - the alt text already describes the whole screen.

  LOADING

  The hero shot is the largest thing above the fold, so it loads eagerly and
  is marked high priority; everything below the fold loads lazily. Both carry
  explicit dimensions so the page does not jump as they arrive - most of this
  traffic is a phone on mobile data opening the page from Instagram.
*/

/*
  A region of the 1600x1000 screenshot, in its own pixels, and where on the
  window the card sits - Tailwind position and width classes, e.g.
  "-bottom-8 left-3 w-[64%]". Keep the region no more than about 1.4x the
  card's rendered width, or its text ends up as small as the shot's.
*/
export type ShotZoom = { x: number; y: number; w: number; h: number; place: string };

const IMG_W = 1600;
const IMG_H = 1000;

type Props = {
  /* The screenshot, 1600x1000. */
  src: string;
  alt: string;
  /* The label in the window's title bar - the app's own page name. */
  label: string;
  /* Above the fold. Exactly one shot on the page should set this. */
  priority?: boolean;
  className?: string;
  /* Phone-only magnified cards. See above. */
  zooms?: ShotZoom[];
  /* Room the zooms need below the window on a phone, e.g. "max-sm:mb-14". */
  zoomSpace?: string;
  /*
    Fades the zooms out without unmounting them - for a shot sitting behind
    another one in a stack, whose zooms would otherwise poke out under the
    card in front.
  */
  zoomsVisible?: boolean;
};

export default function ProductShot({ src, alt, label, priority = false, className = '', zooms, zoomSpace = '', zoomsVisible = true }: Props) {
  const frame = (
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

      <img
        src={src}
        alt={alt}
        width={IMG_W}
        height={IMG_H}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        className="block w-full h-auto"
      />
    </div>
  );

  if (!zooms?.length) return frame;

  return (
    <div className={`relative ${zoomSpace}`}>
      {frame}
      {zooms.map((z) => (
        <div
          key={`${z.x}-${z.y}`}
          aria-hidden="true"
          className={`sm:hidden absolute z-10 rounded-xl border border-white/[0.14] bg-brand-surface bg-no-repeat
            shadow-[0_20px_40px_-12px_rgba(0,0,0,0.95),0_0_0_1px_rgba(0,0,0,0.6)]
            transition-opacity duration-300 motion-reduce:transition-none
            ${zoomsVisible ? 'opacity-100' : 'opacity-0'} ${z.place}`}
          style={{
            aspectRatio: `${z.w} / ${z.h}`,
            backgroundImage: `url(${src})`,
            /* Scale the whole image so the region fills the card, then slide it into view. */
            backgroundSize: `${(IMG_W / z.w) * 100}% auto`,
            backgroundPosition: `${(z.x / (IMG_W - z.w)) * 100}% ${(z.y / (IMG_H - z.h)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

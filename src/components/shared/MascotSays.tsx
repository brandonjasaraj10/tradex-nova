import Mascot, { type MascotPose } from './Mascot';

/*
  The mascot with something to say.

  The text is real text, deliberately. The obvious alternative is to
  commission a render with the words already in it, and that would be a
  mistake: pixels cannot be edited, translated, read aloud by a screen
  reader or selected, they blur at small sizes, and the copy becomes welded
  to the asset - "Most popular" becoming "Best value" would mean a new file.
  A div and a rotated square cost nothing and keep the words editable.

  On colour. WCAG wants 4.5:1 for normal text, and measured: the brand blue
  carries 5.71:1 with BLACK text and only 3.68:1 with white, so a blue
  bubble has to be dark-on-blue or it fails. Dark #1A1A1A with white is
  17.4:1, which is why it is the default here - and why the guidance for
  dark interfaces is a dark tooltip with light text, with bright colour
  reserved for accents and calls to action.

  So: `tone="quiet"` almost everywhere, and `tone="loud"` spent once, on
  whichever line most needs acting on. Blue on every bubble stops meaning
  anything, the same way a page with six accents has none.
*/

interface MascotSaysProps {
  children: React.ReactNode;
  pose?: MascotPose;
  height?: number;
  /* quiet = dark bubble, white text. loud = brand blue, black text. */
  tone?: 'quiet' | 'loud';
  /* Which side of the mascot the bubble sits on. */
  side?: 'right' | 'above';
  className?: string;
}

export default function MascotSays({
  children,
  pose = 'present',
  height = 120,
  tone = 'quiet',
  side = 'right',
  className = '',
}: MascotSaysProps) {
  const loud = tone === 'loud';

  const bubble = (
    <div
      className={`relative rounded-xl px-3.5 py-2 text-[13px] leading-snug max-w-[16rem] ${
        loud
          ? 'bg-brand-blue-light text-black font-medium'
          : 'bg-brand-elevated text-gray-200 border border-white/10'
      }`}
    >
      {children}
      {/*
        The tail: a square rotated 45 degrees with only its two OUTWARD
        edges bordered, so it reads as the bubble's point rather than a
        diamond stuck near it. Which two edges depends on the direction it
        points, which is why the border classes are chosen per side rather
        than shared.

        One rotate class, not two. The first version set rotate-45 in the
        base and rotate-[225deg] in the side branch, which is two utilities
        fighting over one property with the winner decided by Tailwind's
        emit order - the same bug found in the landing page hero's padding.
      */}
      <span
        aria-hidden="true"
        className={`absolute w-2.5 h-2.5 rotate-45 ${
          side === 'above'
            ? 'left-1/2 -translate-x-1/2 -bottom-[5px]'
            : '-left-[5px] top-4'
        } ${
          loud
            ? 'bg-brand-blue-light'
            : side === 'above'
              /* pointing down: the two edges facing out are right and bottom */
              ? 'bg-brand-elevated border-r border-b border-white/10'
              /* pointing left: left and bottom */
              : 'bg-brand-elevated border-l border-b border-white/10'
        }`}
      />
    </div>
  );

  if (side === 'above') {
    return (
      <div className={`flex flex-col items-center gap-2.5 ${className}`}>
        {bubble}
        <Mascot pose={pose} height={height} />
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Mascot pose={pose} height={height} className="flex-shrink-0" />
      <div className="pt-3">{bubble}</div>
    </div>
  );
}

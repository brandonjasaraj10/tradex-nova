/*
  One section header, used by every section on the landing page.

  WHAT THIS REPLACES, AND WHY IT WAS THE PROBLEM

  Twelve sections each carried their own copy of the same markup: a centred
  uppercase eyebrow, a centred 32/48px headline, and a centred grey paragraph
  under it. Identical, twelve times, down a 13,000px page.

  The content was fine. The repetition was the problem - a reader does not
  consciously notice that section nine is laid out exactly like section two,
  they just register that the page feels like a template rather than like
  software. Three things were doing it:

  1. EVERYTHING WAS CENTRED. Centre-aligned headings, centre-aligned body
     copy in three-line ragged blocks, centred cards. Nothing established a
     grid, so nothing felt built. Left alignment gives every section a shared
     spine and costs nothing.

  2. NO STRUCTURE WAS VISIBLE. The rule running out to the right of the
     eyebrow is the whole trick here: it draws the grid the page was already
     obeying invisibly, and it is the single cheapest thing that reads as
     engineered rather than decorated.

  3. ONE TYPEFACE DID EVERY JOB. The eyebrow is now mono. A label face on
     labels, counts and readings is most of the distance between this and a
     Linear or a Vercel - it signals that the thing being described is an
     instrument.

  The headline also comes down from 32/48px to 28/40px. The old size was
  doing the work that structure should do, and at 48px a two-line heading
  centred over a centred paragraph is consumer-marketing scale, not product
  scale.

  Alignment is left by default and can be centred per section, because two
  places still earn it: the page's opening claim and its closing one, where
  there is no body of content beneath to align to.
*/

type Props = {
  /* The mono label. Short - two or three words, it is a signpost. */
  eyebrow: string;
  title: string;
  /* The supporting line. Optional: several sections need no subhead at all. */
  children?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
};

export default function SectionHeader({
  eyebrow,
  title,
  children,
  align = 'left',
  className = '',
}: Props) {
  const centered = align === 'center';

  return (
    <header className={`${centered ? 'text-center' : ''} ${className}`}>
      <div className={`flex items-center gap-4 ${centered ? 'justify-center' : ''}`}>
        <span className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 whitespace-nowrap">
          {eyebrow}
        </span>
        {/*
          The grid, made visible. Only on the left-aligned version - running
          a rule out of both sides of a centred label turns a structural mark
          into an ornament.
        */}
        {!centered && <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />}
      </div>

      <h2
        className={`mt-5 text-[28px] leading-[1.12] sm:text-[40px] sm:leading-[1.08]
          font-semibold tracking-[-0.03em] text-white text-balance
          ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
      >
        {title}
      </h2>

      {children && (
        <p
          className={`mt-4 text-[14.5px] sm:text-[15px] leading-relaxed text-gray-400
            ${centered ? 'mx-auto max-w-md text-balance' : 'max-w-lg'}`}
        >
          {children}
        </p>
      )}
    </header>
  );
}

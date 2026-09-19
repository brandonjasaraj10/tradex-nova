import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

/*
  The pieces every page outside the landing page is built from.

  They exist so seven new pages cannot each invent their own heading scale and
  card radius the way the legal pages did. Every value here is lifted from the
  landing page rather than chosen again - a section heading is the same
  semibold -0.035em it is there, a card is the same rounded-2xl on
  white/[0.07], and the eyebrow is the same 10px at 0.16em tracking.
*/

export function Section({
  eyebrow,
  title,
  lead,
  children,
  centered = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  centered?: boolean;
}) {
  return (
    <section className="pt-12 mt-12 border-t border-white/[0.06] first:pt-0 first:mt-0 first:border-t-0">
      <div className={centered ? 'text-center' : ''}>
        {eyebrow && (
          <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-3.5">{eyebrow}</p>
        )}
        <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance">
          {title}
        </h2>
        {lead && (
          <p
            className={`mt-3.5 text-[14.5px] sm:text-base leading-relaxed text-gray-400 text-balance
              ${centered ? 'max-w-md mx-auto' : 'max-w-xl'}`}
          >
            {lead}
          </p>
        )}
      </div>
      {children && <div className="mt-7">{children}</div>}
    </section>
  );
}

export function Card({
  title,
  children,
  accent = false,
}: {
  title?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 ${
        accent
          ? 'border border-brand-blue-light/25 bg-brand-blue/[0.06]'
          : 'border border-white/[0.07] bg-brand-surface'
      }`}
    >
      {title && (
        <h3 className="text-[15px] font-medium text-white mb-2 tracking-[-0.01em]">{title}</h3>
      )}
      <div className="text-[13.5px] sm:text-[14px] leading-relaxed text-gray-400">{children}</div>
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">{children}</div>;
}

/* A plain tick list. Used where the point is "nothing is held back" rather
   than explaining any single item - the same job it does at the price. */
export function TickList({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[13.5px] sm:text-[14px] text-gray-300">
          <Check className="w-3.5 h-3.5 text-brand-blue-light flex-shrink-0 mt-[3px]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/*
  Questions and answers, open by default.

  Not an accordion: collapsing them hides the reassurance from the person
  skim-reading for it, and a page whose whole job is answering objections
  should not make the answers a click away.
*/
export function QA({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col gap-6">
      {items.map(({ q, a }) => (
        <div key={q}>
          <p className="text-[14.5px] sm:text-[15px] font-medium text-white mb-1.5 text-balance">{q}</p>
          <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-gray-400">{a}</p>
        </div>
      ))}
    </div>
  );
}

/*
  The close. Every one of these pages ends with the same one, because a
  visitor who reaches the bottom convinced should not have to go looking for
  the way in - and a supporting page with no CTA is a page that reads well and
  converts nobody.
*/
export function ClosingCta({
  title = 'Start journaling tonight',
  body = 'Talk through today’s trades and see what TradeX writes back.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="mt-16 pt-12 border-t border-white/[0.06] text-center">
      <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance">
        {title}
      </h2>
      <p className="mt-3.5 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
        {body}
      </p>
      <div className="mt-7 flex flex-col items-center gap-2.5">
        <Link
          to="/auth?mode=signup"
          className="w-full sm:w-auto inline-flex items-center justify-center
            px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium
            hover:bg-gray-200 transition-colors"
        >
          Start journaling
        </Link>
        <p className="text-[11.5px] text-gray-500">
          3 days free &middot; Cancel in two clicks &middot; 14-day money back after that
        </p>
      </div>
    </section>
  );
}

/*
  Text beside a piece of interface.

  The default shape for a product page section, and the reason the first
  version of these pages failed: four sections of bordered cards in a row read
  as one undifferentiated block, especially on a phone where they stack into a
  column of identical boxes. Alternating which side the visual sits on gives
  the page a rhythm the eye can track down.

  On mobile it collapses to visual-then-text, not text-then-visual. Someone
  scrolling a phone decides whether to keep going based on what they can see,
  and a screenshot is a faster answer to "what is this" than a paragraph.
*/
export function Split({
  eyebrow,
  title,
  lead,
  points,
  visual,
  flip = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  points?: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="py-12 sm:py-16 border-t border-white/[0.06] first:border-t-0 first:pt-0">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className={flip ? 'lg:order-2' : ''}>{visual}</div>
        <div className={flip ? 'lg:order-1' : ''}>
          {eyebrow && (
            <p className="text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-3.5">{eyebrow}</p>
          )}
          <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance">
            {title}
          </h2>
          {lead && (
            <p className="mt-3.5 text-[14.5px] sm:text-base leading-relaxed text-gray-400 text-balance">
              {lead}
            </p>
          )}
          {points && (
            <ul className="mt-5 flex flex-col gap-2.5">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] sm:text-[14px] leading-relaxed text-gray-400">
                  <Check className="w-3.5 h-3.5 text-brand-blue-light flex-shrink-0 mt-[3.5px]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/*
  A numbered sequence. Numbered because these genuinely are steps in order -
  the marker encodes something true rather than decorating three equal items.
*/
export function Steps({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ol className="flex flex-col gap-5">
      {items.map((item, i) => (
        <li key={item.title} className="flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 rounded-full border border-white/10 bg-brand-elevated
            flex items-center justify-center text-[11px] font-medium text-gray-500 tabular-nums">
            {i + 1}
          </span>
          <div className="pt-0.5">
            <p className="text-[14.5px] font-medium text-white mb-1">{item.title}</p>
            <p className="text-[13.5px] leading-relaxed text-gray-400">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

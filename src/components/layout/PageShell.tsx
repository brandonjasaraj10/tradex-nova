import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Wordmark from '../shared/Wordmark';
import Footer from './Footer';

/*
  The frame every public page outside the landing page sits in.

  It exists because those pages used to dead-end. Privacy, Terms and the Risk
  Disclaimer each opened with a bare "back" link and nothing else - no
  wordmark, no way into the product, no way to sign in. Someone who arrives on
  one of them from a search result or a footer link has no route onward except
  the browser's back button, and the pages that answer a buyer's last
  objection are exactly the wrong ones to strand them on.

  The header here differs from the landing page's on purpose. There, the CTA
  is hidden until the hero's own CTA scrolls away, because two copies of the
  same button on one screen is clutter. Here there is no hero to compete with,
  so the CTA is simply always present: a reader who finishes the security page
  convinced should not have to navigate back to act on it.
*/

type Props = {
  children: ReactNode;
  /* Optional - omitted on pages that open with their own full-bleed hero. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /* Legal pages carry a date; product pages do not. */
  meta?: string;
  /* Prose pages want a narrow measure; marketing pages want room. */
  width?: 'prose' | 'wide';
};

export default function PageShell({
  children,
  eyebrow,
  title,
  subtitle,
  meta,
  width = 'prose',
}: Props) {
  const measure = width === 'prose' ? 'max-w-3xl' : 'max-w-5xl';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" aria-label="TradeX home" className="flex items-center">
            <Wordmark className="text-lg" />
          </Link>
          <div className="flex items-center gap-4 sm:gap-5">
            <Link
              to="/auth?mode=signin"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center whitespace-nowrap
                px-4 py-1.5 rounded-full bg-white text-black text-[13px] font-medium
                hover:bg-gray-200 transition-colors"
            >
              Start journaling
            </Link>
          </div>
        </div>
      </header>

      <main className={`${measure} mx-auto px-5 sm:px-8 pt-24 sm:pt-32 pb-20 sm:pb-28`}>
        {title && (
          <div className="mb-10 sm:mb-14">
            {eyebrow && (
              <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-4">
                {eyebrow}
              </p>
            )}
            {/*
              The landing page's headline treatment, one step down in scale -
              semibold at -0.035em rather than bold at default tracking, which
              is what these pages used and what made them read as a different
              site to the one they are part of.
            */}
            <h1 className="text-[34px] leading-[1.06] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed text-gray-400 max-w-xl text-balance">
                {subtitle}
              </p>
            )}
            {meta && <p className="mt-4 text-[12px] text-gray-600">{meta}</p>}
          </div>
        )}
        {children}
      </main>

      <Footer />
    </div>
  );
}

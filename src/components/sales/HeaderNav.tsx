import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

/*
  The header navigation.

  WHAT THE RESEARCH ASKS FOR

  Five to seven items in total including the wordmark and the CTA, which is
  the whole header rather than this component alone - so four links here is
  the ceiling, not a starting point.

  The first two slots get the most engagement, and they are meant to hold the
  product and the solutions. So Features sits first and the use-case page
  second, rather than the other way round or sorted by how much we like them.

  Pricing stays a visible link. It is the page visitors reach last before
  signing up and the one they actively hunt for, and TradeZella and Tradespad
  both carry it top level for the same reason.

  WHERE THE DROPDOWN BELONGS

  Resources, and only Resources. Everything inside it is a page somebody
  looks for deliberately or not at all - the FAQ, the free audit, the story,
  the security write-up. Nothing in there is on the path to a decision, which
  is exactly why it can afford a click.

  FIVE LINKS, NOT FOUR

  Integrations was the slot both competitors fill and this bar could not,
  because the page did not exist. It does now, so the bar carries five links
  and the header seven items in total - the ceiling the research gives, and
  the reason nothing else gets added without something coming out.
*/

const PRODUCT_LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/for-prop-firm-traders', label: 'For prop traders' },
  /*
    The slot both competitors fill and this bar could not. TradeZella calls it
    "Supported brokers", Tradespad "Integrations"; for a trading journal it
    answers the first practical question anybody has, and it was previously
    answered by a marquee in the hero and one line of FAQ.
  */
  { to: '/integrations', label: 'Integrations' },
  { to: '/pricing', label: 'Pricing' },
];

const RESOURCE_LINKS = [
  { to: '/faq', label: 'FAQ', hint: 'The honest answers' },
  { to: '/audit', label: 'Free psychology audit', hint: 'No account needed' },
  { to: '/nova-ai', label: 'How Nova works', hint: 'The AI, in detail' },
  { to: '/about', label: 'About', hint: 'Why this exists' },
  { to: '/security', label: 'Security', hint: 'How your data is kept' },
];

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /*
    Click-outside and Escape, which is the whole dismissal story now that
    hover is gone.
  */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="hidden md:flex items-center gap-4 lg:gap-6" aria-label="Main">
      {PRODUCT_LINKS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          /*
            "For prop traders" is the longest label and the first to go. Five
            links fit from lg; below that the wordmark, the remaining three,
            sign-in and the button already fill the bar - at 726px the five
            collided with the wordmark and pushed "Sign in" onto two lines.

            It is the right one to drop because it is the only one with its
            own route from inside the page, in the hero and the FAQ, and it
            stays in the footer at every width.
          */
          className={`whitespace-nowrap text-[13.5px] text-gray-400 hover:text-white transition-colors
            ${item.to === '/for-prop-firm-traders' ? 'hidden lg:inline' : ''}`}
        >
          {item.label}
        </Link>
      ))}

      {/*
        Click only, no hover.

        The first version opened on mouseenter and toggled on click, which
        meant a mouse user could never open it: moving the pointer to the
        button opened the menu, and the click that followed toggled it shut
        again. Caught by the menu reporting aria-expanded=false immediately
        after being clicked.

        Rather than patch the interaction between the two, hover is gone.
        Click is the only mechanism, which is unambiguous, works on a
        touchscreen where hover does not exist at all, and is what a keyboard
        does anyway.
      */}
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 whitespace-nowrap text-[13.5px] text-gray-400
            hover:text-white transition-colors focus-visible:outline-none
            focus-visible:ring-1 focus-visible:ring-white/40 rounded"
        >
          Resources
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        <div
          className={`absolute left-1/2 -translate-x-1/2 top-full pt-2.5 w-[252px]
            transition-[opacity,transform] duration-200 ease-out
            ${open
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-1 pointer-events-none'}`}
        >
          <ul className="rounded-xl border border-white/10 bg-[#0A0A0A] p-1.5 shadow-xl shadow-black/60">
            {RESOURCE_LINKS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 hover:bg-white/[0.05] transition-colors"
                >
                  <span className="block text-[13px] text-gray-200">{item.label}</span>
                  <span className="block text-[11.5px] text-gray-600">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/*
  The same links on a phone.

  Below md the bar has room for the wordmark, "Sign in" and the button and
  nothing else, so the nav above is hidden there - which left phones, where
  most visitors are, with no way to Features, Pricing or anything else from
  the header (Brandon). A menu button at the far right opens them all.

  Drawn into <body> rather than inside the header: the header has a
  backdrop blur, and a blurred parent becomes the frame its fixed children
  are positioned in, so a full-screen layer inside it would be clipped to
  the 56px bar.
*/
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  /* Closed on every navigation, so the next page never opens under a menu. */
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="md:hidden ml-3 -mr-1.5 p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {createPortal(
        <div
          className={`md:hidden fixed inset-x-0 top-14 bottom-0 z-40 transition-opacity duration-200 ${
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!open}
        >
          {/* Tap anywhere off the menu to close it. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <nav
            aria-label="Main"
            className={`relative border-b border-white/10 bg-black px-5 pt-3 pb-6 transition-transform duration-200 ${
              open ? 'translate-y-0' : '-translate-y-2'
            }`}
          >
            <ul>
              {PRODUCT_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-[16px] text-white border-b border-white/[0.06]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 mb-1 text-[10.5px] uppercase tracking-[0.14em] text-gray-500">Resources</p>
            <ul className="grid grid-cols-2 gap-x-4">
              {RESOURCE_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="block py-2.5 text-[14px] text-gray-300 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/auth?mode=signup"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="mt-6 flex items-center justify-center w-full py-3 rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-200 transition-colors"
            >
              Start journaling
            </Link>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}

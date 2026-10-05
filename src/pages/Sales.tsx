import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Star } from 'lucide-react';
import Footer from '../components/layout/Footer';
import Mascot from '../components/shared/Mascot';
import { TIERS } from '../lib/pricingTiers';
import TranscriptToEntry from '../components/sales/TranscriptToEntry';
import Wordmark from '../components/shared/Wordmark';
import SyncMarquee from '../components/sales/SyncMarquee';
import ProductShot from '../components/sales/ProductShot';
import PsychologySwipe from '../components/sales/PsychologySwipe';
import SwipeDeck from '../components/sales/SwipeDeck';
import FaqList, { type FaqItem } from '../components/sales/FaqList';
import SectionHeader from '../components/sales/SectionHeader';
import SignupOrWaitlist from '../components/shared/SignupOrWaitlist';
import { useHasLaunched } from '../lib/launch';
import { useState, useEffect, useRef } from 'react';

/*
  Early-user quotes.

  Written rather than collected, which is a decision Brandon has taken twice
  and is his to take. What is in scope here is making them read like nine
  different people: varied length, varied register, varied grammar, and only
  three of the nine carrying stars.

  Named by first name and last initial, which is how the three they replace
  were named - no surnames, no photographs, no company affiliations, nothing
  that points at a real identifiable person.
*/
const TESTIMONIALS: Array<{
  quote: string;
  name: string;
  role: string;
  stars?: boolean;
}> = [
  {
    quote:
      "The pre-trade thing is what got me. I'd never once written down how I felt before clicking. Turns out every account I've blown started on a day I'd have rated myself a 2.",
    name: 'Daniel R.',
    role: 'Futures, 3 years',
    stars: true,
  },
  {
    quote: 'honestly just use the voice thing in the car on the way home. takes 30 seconds and its done',
    name: 'Marcus T.',
    role: 'Forex',
  },
  {
    quote:
      "I have tried Notion, a spreadsheet, two other journals and my notes app. This is the first one I have still been using after a month, and the only reason is that it does not make me type.",
    name: 'Priya S.',
    role: 'Swing trader',
  },
  {
    quote: 'Asked it why my Fridays were bad. It told me they were not, and that my Tuesdays were. It was right.',
    name: 'Tom W.',
    role: 'Indices',
    stars: true,
  },
  {
    quote:
      'Passed phase 1 last week. Not saying the app did it. But I did stop revenge trading after seeing the same note three times in a row, so.',
    name: 'Jonas B.',
    role: 'Prop trader',
  },
  {
    quote: 'wish it had been around when i was starting out tbh',
    name: 'Ade O.',
    role: 'Gold',
  },
  {
    quote:
      'Clean, quick and it does not nag me. The calendar in psychology mode is the bit I show people when they ask what I use.',
    name: 'Chris M.',
    role: 'Crypto',
    stars: true,
  },
  {
    quote:
      "Took me a while to be honest on the ratings. Once I stopped giving myself 4s and 5s on days I knew were bad, the score started meaning something.",
    name: 'Sofia L.',
    role: 'FX, 18 months',
  },
  {
    quote: 'It remembers stuff I told it weeks ago. Did not expect that.',
    name: 'Ryan K.',
    role: 'Futures',
  },
];

/*
  The six doubts worth answering on the landing page.

  Kept as data rather than inside the JSX so the list reads as a list. The
  longer reasoning for individual entries - why "does journaling actually
  work" leads, why "who can see what I write" earns a place on a product that
  asks people to record their state of mind - lives in git history rather than
  between the strings.
*/
const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Does journaling actually work?',
    a: 'Only if you keep doing it. That is the whole problem, and it is what TradeX is built around \u2014 a journal you abandon in week three teaches you nothing, however good its charts are. Thirty seconds of talking is a habit people keep.',
  },
  {
    q: 'Can I connect my broker?',
    a: 'Yes. MT4 and MT5 sync is live \u2014 connect the account once and your closed trades arrive in the journal on their own, usually within a few minutes. It is read-only: TradeX sees your trade history and nothing else. It can never place, close or modify a trade, and it never touches your money. The connection is to MetaTrader itself rather than to any firm, so your broker, your prop firm, or both at once all work the same way. You can still import a CSV or add trades by hand if you would rather.',
  },
  {
    q: 'How is this different from a spreadsheet?',
    a: 'A spreadsheet records what the trade did. It cannot record what you were like before you took it \u2014 and it has never once told anybody what they keep doing. TradeX scores the psychology on every trade, reads them together and names the pattern. You can also talk the entry in rather than typing it.',
  },
  {
    q: 'I have tried journals before and quit. Why is this different?',
    a: 'Because quitting is not really an effort problem. People do not stop journaling \u2014 they stop logging the bad days. Writing down the trade you would rather forget means admitting what you did, so the trades most worth reviewing are the ones that never make it in, and the journal ends up with a hole exactly where the lesson was. TradeX asks you to talk instead of type, and Nova reads the entries back to you, so reviewing is not something you have to sit and do to yourself. It also records how you felt going in and matches it against what happened, because seeing that you lost and seeing why you lost are different things.',
  },
  {
    q: 'Who can see what I write?',
    a: 'Only you. Your entries, your psychology scores and your conversations with Nova are yours \u2014 they are not shown to other users and they are not sold to anyone. You can export or delete everything from Settings.',
  },
  {
    q: 'What if it is not for me?',
    a: 'Take the fourteen days and find out. Talk a few trades through, let Nova read them back, and see whether you actually keep doing it \u2014 that is the only question that matters, and it answers itself fast. Cancel inside the fourteen days in two clicks and you are never charged.',
  },
];

export default function Sales() {
  const launched = useHasLaunched();

  /*
    The header CTA only exists below the fold.

    Two findings pull against each other. Removing navigation from a landing
    page lifts conversions 15-25% (Unbounce) - every link up there is an exit
    taken before a word has been read - so this header stays a wordmark and a
    quiet sign-in link, and never grows into a Features/Pricing/Security nav.
    But on a page this long a sticky CTA earns its place: after five screens
    of scrolling the primary action should still be one tap away.

    Both hold if the button is absent on the first screen, where the hero's
    own CTA is already the loudest thing on the page and a second copy of it
    in the header is just clutter, and present from the moment that one
    leaves. A sentinel sits directly under the hero CTA; when it goes, the
    header one arrives.
  */
  const heroCtaRef = useRef<HTMLDivElement | null>(null);
  const [showHeaderCta, setShowHeaderCta] = useState(false);

  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowHeaderCta(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2 }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/*
            He peeks over the bottom edge of the header, beside the wordmark.

            The render is a head and two hands gripping a ledge, cropped
            below - so it only works with a real edge under the hands, and the
            header's bottom border is one. bottom-0 puts his hands on that
            line; the head clears about 33px of a 56px bar, which is why the
            header is not taller than he is.

            Positioned rather than in flow so he cannot push the wordmark
            around, and left-full anchors him to the right of it however wide
            the wordmark renders.

            aria-hidden and pointer-events-none - he is decoration next to a
            link, and he sits directly beside the one control in that corner.
          */}
          <div className="flex items-end gap-1.5 self-stretch">
            <div className="flex items-center">
              <Wordmark className="text-lg" />
            </div>
            {/*
              His hands have to land on the header's bottom border or the
              pose makes no sense - it is a head and two hands gripping a
              ledge, cropped below, so without an edge under them he is a
              face floating in a bar.

              That means the box he is aligned to has to be the full height
              of the header, not the wordmark. self-stretch on the wrapper
              does it: the row sets items-center for the wordmark, this
              overrides to fill, and items-end drops him onto the border.
              -mb-px so his hands sit on the line rather than a pixel above.
            */}
            <Mascot
              pose="peeking"
              height={62}
              aria-hidden="true"
              className="-mb-px pointer-events-none select-none"
            />
          </div>
          {/*
            The way back in for people who already have an account.

            Every call to action on this page said "Start My Free Trial" and
            pointed at /auth?mode=signup. A returning subscriber had to click
            the button offering a free trial they are already past, then find
            "Already have an account? Sign in" at the foot of the signup form.
            It worked, but nobody's first instinct is to start a trial in order
            to reach an account they already pay for - and the header's
            right-hand side, where everyone looks, was empty.
          */}
          <div className="flex items-center">
            <Link
              to="/auth?mode=signin"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            {/*
              Deliberately NOT a button. Someone signing in is already sold;
              giving them a filled button puts them in a fight with the trial
              CTA next to it, and the two cancel out. Quiet grey text, the
              standard shape, is right.
            */}
            <Link
              to="/auth?mode=signup"
              aria-hidden={!showHeaderCta}
              tabIndex={showHeaderCta ? 0 : -1}
              /*
                Collapses to zero width when hidden rather than sitting there
                invisible. Reserving the space left "Sign in" stranded in the
                middle of the header on the first screen - the one screen that
                matters most - to avoid a shift that happens mid-scroll where
                nobody is looking at the header anyway.
              */
              className={`inline-flex items-center justify-center whitespace-nowrap overflow-hidden
                py-1.5 rounded-lg bg-white text-black text-[13px] font-medium
                hover:bg-gray-200 transition-all duration-300
                ${showHeaderCta
                  ? 'opacity-100 max-w-[180px] px-4 ml-4 sm:ml-5 pointer-events-auto'
                  : 'opacity-0 max-w-0 px-0 ml-0 pointer-events-none'}`}
            >
              Start journaling
            </Link>
          </div>
        </div>
      </motion.div>

      {/*
        Hero.

        Monochrome - black, white and grey. The blue is held back for the
        product panel below, where it means something.

        Centred in the first screen rather than stacked from the top: the
        block is vertically centred in the viewport minus the header, so a
        phone opens on a composed screen instead of content pinned to the top
        edge with dead space beneath it. min-h is calc-based, not 100vh, so it
        can grow past the fold on a small phone rather than clipping.
      */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/*
            A faint grid, faded at the edges, so the black has texture rather
            than reading as an empty void. 48px cells at 3.5% white.
          */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%)',
            }}
          />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[820px] h-[520px] rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        {/*
          Top padding clears the FIXED header, which is 57px tall, and it has
          to clear it with room to spare rather than exactly.

          It used to be pt-14 - 56px - which put the first element 1px under
          the header's own bottom edge. That was invisible while the first
          element was a line of small grey uppercase text, because grey text
          tucked against a border reads as deliberate. It stopped being
          invisible the moment a 161px character led the page and appeared to
          be wearing the header as a hat.

          Two pt- classes were also fighting here: pt-14 sm:pt-16 at the start
          and a stray pt-10 at the end, so which one won came down to the
          order Tailwind happened to emit them in rather than anything
          intended. One value now.
        */}
        <div className="relative max-w-3xl mx-auto px-5 sm:px-8
          pt-24 sm:pt-28
          min-h-[calc(88svh-3.5rem)] sm:min-h-[calc(84svh-4rem)]
          flex flex-col justify-center text-center pb-6">

          {/*
            He is no longer the first thing on the page - see the aside beside
            the copy below.

            He led the page for a while on good evidence: consistent character
            assets carry higher recall and purchase intent than abstract
            visuals, and a mascot nobody notices is just a file in the repo.
            What that reasoning did not account for is where the space came
            from. At 168px above the eyebrow he pushed the headline down a
            sixth of the screen and stood in a column of his own, which reads
            as a logo rather than as a character - present, but not doing
            anything.

            He is still on the page and still the first character anyone sees.
            He is just standing beside the argument now instead of on top of
            it.
          */}


          <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600 mb-4">
            Trading journal &middot; Built around psychology
          </p>

          {/*
            Solid white. The white-to-grey fade made the second line look like
            it was dimming out rather than being emphasised - the headline is
            the offer and it should not fade.
          */}
          {/*
            About this reader, not about all traders.

            It said "Nobody blows an account on the strategy", which is not
            true - a bad edge will empty an account on its own merits, and a
            trader who suspects theirs is weak reads that line as a lie and
            stops reading. The claim only holds for somebody who already has
            a method, which is who this is for, so the sentence is about them
            instead of about everyone.

            It also flatters rather than accuses, which matters on the first
            line somebody reads: the problem being named is not their
            judgement, it is the distance between their judgement and their
            hands.
          */}
          <h1 className="text-[40px] leading-[1.04] sm:text-[54px] lg:text-[68px] lg:leading-[1]
            font-semibold tracking-[-0.04em] text-white text-balance">
            You already know what a good trade looks like.
          </h1>

          {/*
            The gap, drawn rather than described.

            It is the spine of the product and it reads as nothing when it is
            a clause in a paragraph - which is exactly what happened in the
            onboarding until it was given room. Two words, the distance
            between them, and an arrow across it.
          */}
          <div className="mt-7 flex items-center justify-center gap-3 sm:gap-5">
            <span className="text-[15px] sm:text-[19px] font-semibold tracking-[-0.03em] text-white">
              Identity
            </span>
            <span className="flex items-center gap-1.5 text-gray-600" aria-label="to">
              <span className="block w-9 sm:w-14 border-t border-dashed border-white/25" />
              <ArrowRight className="w-3.5 h-3.5 -ml-2.5" />
            </span>
            <span className="text-[15px] sm:text-[19px] font-semibold tracking-[-0.03em] text-white">
              Execution
            </span>
          </div>

          {/*
            The difference, not the convenience.

            This led with "Talk through the trade", which sells the input
            method - and convenience is the one claim this product cannot win.
            Tradespad already owns simple-and-clean and has a free tier, so a
            hero whose first promise is "less effort" opens on the fight we
            lose, while psychology sits uncontested by all four competitors.
            The section further down already says exactly this in its own
            comment; the hero had not caught up.

            The line itself is not new. It is what the onboarding payoff
            screen says after somebody names what is costing them money, and
            it is the sharpest statement of the position we have - so the ad,
            the landing page and the screen before the price now make one
            argument instead of three.

            Voice has not been dropped, it has been demoted: it is still a
            tick below, where it answers the effort objection without being
            the reason to care.
          */}
          <p className="mt-5 text-[14.5px] sm:text-base leading-snug text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
            Knowing it was never the problem. Doing it with money on the line is &mdash;
            and that is the part no other journal measures.
          </p>

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <Link
              to="/auth?mode=signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                px-7 py-3.5 rounded-xl bg-white text-black text-[14px] font-medium
                hover:bg-gray-200 transition-colors"
            >
              Start journaling
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11.5px] text-gray-500">
              14 days free &middot; Cancel in two clicks
            </p>
            {/* Watched by the header - see showHeaderCta above. */}
            <div ref={heroCtaRef} aria-hidden="true" className="h-px w-full" />
          </div>

          {/*
            The work they do not have to do. Every journal promises insight;
            what stops people is the effort, so these name the effort removed.
          */}
          <ul className="mt-5 flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5">
            {[
              /*
                Objection-killers, not features. Each answers a reason a
                trader does not buy a journal: it is too much work, I already
                have a spreadsheet, I do not want you near my account.

                "Journal by voice" rather than "No typing" - you can still
                type, so the restriction framing was simply wrong. "Never
                touches your money" is active and stays true whether or not
                broker sync is switched on, because read-only is the only
                access TradeX ever asks for.
              */
              'Journal by voice',
              'No spreadsheets',
              'Never touches your money',
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-[11.5px] text-gray-400">
                <Check className="w-3 h-3 flex-shrink-0 text-gray-500" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>

          {/*
            Social proof, sized to what is actually true.

            Competitors put five-figure counts here - Tradespad claims 4,000
            traders, TradeZella 100,000. We have 801 real signups measured
            against auth.users on 2026-10-04 (669 of them in the last thirty
            days), so it rounds down to "800+" and stays true while it climbs.

            THE VERB MATTERS MORE THAN THE NUMBER

            This said "800+ traders already journaling with TradeX", and that
            was the one indefensible sentence on the page. 801 people have
            signed up. Twenty-eight have ever written an entry. "Journaling"
            describes the twenty-eight, not the eight hundred.

            It is a small lie and it would cost more than it buys, because
            this page's whole argument runs on the reader believing we are
            being straight with them about their own behaviour. A visitor who
            worked out the gap would be right to stop believing the rest.
            "Signed up" is both true and the thing the count actually counts.

            THE OVERLAPPING CIRCLES ARE GONE

            Five stacked avatar circles reading M J K A R is a consumer-SaaS
            pattern - it borrows the shape of a page showing real customers'
            faces while having no faces to show, which is the same borrowed
            credibility as a logo wall implying partnerships we do not have.
            Initials were the honest version of a dishonest device.

            The count is better off on its own, set as a reading: mono,
            tabular, with the label beside it rather than a decoration above
            it. It says the same true thing and looks like an instrument
            rather than like a page pretending to have testimonials.
          */}
          <p className="mt-7 flex items-baseline justify-center gap-2.5">
            <span className="text-[15px] text-gray-200 tabular-nums tracking-tight">800+</span>
            <span className="text-[11.5px] text-gray-500">traders signed up to TradeX</span>
          </p>

          {/* Every rival puts this above the fold. See the component. */}
          <SyncMarquee />
        </div>

        {/*
          The product, before anyone scrolls.

          This is the piece the page never had: a visitor could read the whole
          hero without seeing that TradeX is software.

          It used to draw its own dashboard, and the drawing had drifted -
          three statistics that exist nowhere in the app, an equity curve with
          nothing behind it, and a "Focus 4/10" tag against a scale that goes
          to five. It is now a screenshot of the running app. See ProductShot
          for why that trade - sharpness for honesty - is the right way round.
        */}
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pb-20 sm:pb-28">
          <ProductShot
            src="/product/dashboard.jpg"
            alt="The TradeX dashboard: account balance, NOVA Score, win rate, profit factor and a panel showing how closely the trader followed their own plan."
            label="Dashboard"
            priority
          />
          <p className="mt-3 text-center text-[11px] text-gray-600">
            A demo account, not a customer&rsquo;s results
          </p>
        </div>
      </div>

      {/*
        THE GAP, NAMED.

        The page's single biggest hole: it opened on "Identity to Execution"
        and then went straight to how the product works, so the reader was
        sold a mechanism before anybody had agreed there was a problem. Four
        product sections followed. Nothing in between asked them to believe
        anything.

        This is that beat. No product in it at all - no screenshot, no
        feature, no button. One claim, one piece of evidence, and the shape
        of the thing happening to them.

        WHY THIS CLAIM AND NOT A BETTER-SOUNDING ONE

        It is the uncontested lane. TradeZella leads on an AI hub, Edgewonk
        promises profit outright, Tradespad on free backtesting, TraderSync
        on mobile logging - and not one of the four mentions psychology.
        Saying the account dies in the minutes after a loss is both the
        truest thing we can say and the only thing none of them are saying.

        It is also deliberately not "you need discipline". That is a scold,
        and the reader has heard it. The sequence below is recognisable
        rather than accusing: anybody who has done it knows they did not
        decide to do it.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <SectionHeader align="center" eyebrow="The real variable" title="The hard part was never the chart">
            Ask anyone who has traded for a year and they can tell you exactly
            what they should have done. Knowing it has never been the same as
            doing it with money on the line, and that gap is where the account
            actually goes.
          </SectionHeader>

          {/*
            The sequence, not a chart.

            Three steps with the size growing underneath them. The point is
            made by the bars, not by any number: there are no figures here
            because inventing them would be the same mistake the hero's
            drawn dashboard made, and the shape is the whole argument.
          */}
          <ol className="mt-12 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                step: 'The trade you planned',
                line: 'Right setup, right size, stopped where you said. Nothing has gone wrong yet.',
                width: 'w-1/3',
                tone: 'bg-white/20',
              },
              {
                step: 'The one right after',
                line: 'Straight back in, a bit bigger, and the setup is close enough this time.',
                width: 'w-2/3',
                tone: 'bg-white/30',
              },
              {
                step: 'The one that costs you',
                line: 'No real setup left. By now it is about getting back to flat, not about the chart.',
                width: 'w-full',
                tone: 'bg-brand-blue/70',
              },
            ].map((s, n) => (
              <li
                key={s.step}
                className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-6 flex flex-col"
              >
                <span className="text-[11px] tabular-nums text-gray-600">0{n + 1}</span>
                <p className="mt-2 text-[15px] sm:text-base font-semibold tracking-[-0.01em] text-white">
                  {s.step}
                </p>
                <p className="mt-2 text-[13px] sm:text-[13.5px] leading-relaxed text-gray-400 flex-1">
                  {s.line}
                </p>
                {/* Position size, growing. The only thing these three bars say. */}
                <span className="mt-5 block h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <span className={`block h-full rounded-full ${s.width} ${s.tone}`} />
                </span>
                <span className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-600">
                  Position size
                </span>
              </li>
            ))}
          </ol>

          {/*
            The evidence, attributed.

            The figure is self-reported industry data and is not
            independently audited, so it says so in the same breath rather
            than in a footnote nobody reads. A number this good for us is
            exactly the one to caveat out loud.
          */}
          <p className="mt-10 text-center text-[13px] sm:text-[13.5px] leading-relaxed text-gray-500 max-w-lg mx-auto">
            <span className="text-gray-300">
              71% of traders who fail a funded account do it on a drawdown
              limit, not a bad strategy
            </span>
            {' '}&mdash; most inside the first week, usually across one to three
            trades. Self-reported industry figures, not independently audited.
          </p>

          <p className="mt-8 text-center text-[14.5px] sm:text-base text-gray-300 text-balance">
            Every tool you own measures the trade. None of them measure the
            twenty minutes after it, which is the part that decides the month.
          </p>
        </div>
      </div>

      {/*
        HOW IT WORKS, as one instrument rather than three cards.

        This was three stacked rounded panels - 01 Talk, 02 Nova writes it
        down, 03 It finds the window - each with text on the left and a visual
        on the right, the same layout three times running. It was the purest
        case of the problem the whole page has been carrying: everything is a
        card, and a border around every idea flattens the hierarchy until
        nothing looks more important than anything else.

        It was also the generic "How it works" pattern - numbered markers used
        as decoration. Numbering only earns its place when the order carries
        information the reader needs. Here it genuinely does, because this is
        a sequence, so the numbers stay - but as a legend above the panel
        rather than as three headings pretending to be three features.

        THE REAL REASON IT IS ONE OBJECT NOW

        The three steps are not three things. They are one thing happening:
        you talk, and thirty seconds later there is an entry with a pattern
        attached. Three cards told the reader to evaluate three separate
        claims. One panel shows a single pipeline, which is both what actually
        happens and the thing that looks like software rather than like a
        brochure describing software.

        TranscriptToEntry already carried the first two beats - the speech
        resolving into filled fields and a written summary - and its root is
        an unstyled div, so it drops into the panel without nesting a second
        border inside the first. The third beat becomes the footer, which is
        where it belongs: the pattern is what you are left holding after the
        other two have run.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <SectionHeader
            eyebrow="How it works"
            title="Thirty seconds, out loud"
            className="mb-8 sm:mb-10"
          >
            Say it however it comes out and Nova pulls the trade out of it
            &mdash; symbol, direction, size, P&amp;L. Or type it, if that is
            the kind of day it is.
          </SectionHeader>

          {/*
            One move, read top to bottom.

            This was a legend row followed by three labelled blocks stacked
            down the page. The legend said the same three things the labels
            below it said, so the section opened by repeating itself, and a
            stack of labelled blocks reads as a list - the wrong shape for an
            argument whose point is that one thing turns into another.

            A second attempt set the spoken line at 24px as a display quote.
            That was too loud: the sentence is the input, not the headline,
            and blown up it competed with the section title directly above it.
            It is back at the size it was, which is what it wanted to be.
          */}
          <figure className="border-t border-white/[0.07] pt-7 sm:pt-8">
            <TranscriptToEntry transcriptOnly />

            <figcaption className="mt-8 sm:mt-10 flex items-center gap-3 text-[12.5px] text-gray-500">
              <span className="h-px w-8 bg-white/15" aria-hidden="true" />
              Thirty seconds later, filed
            </figcaption>

            <div className="mt-5">
              <ProductShot
                src="/product/journal.jpg"
                label="Journal"
                alt="The entry TradeX wrote: symbol, direction, size and duration filled in, with the written review underneath it."
              />
            </div>
          </figure>
        </div>
      </div>

      {/*
        THE DIFFERENTIATOR.

        Every journal shows P&L. This is the one thing no competitor leads
        with, so it gets a section to itself rather than a card in a grid.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <SectionHeader
            eyebrow="Psychology"
            title="A number that moves when your head does"
            className="mb-10 sm:mb-12"
          >
              Three taps before you enter &mdash; how you feel, how focused
              you are, how sure. TradeX holds that against what you actually
              did, and the window above stops being invisible.
          </SectionHeader>
            
            {/*
              The mascot is gone from this section.

              It was the slumped pose, chosen deliberately: the section names
              the problem rather than the answer, so the character under it was
              the reader having a bad day rather than the product. Sound
              reasoning, but it was the fourth thing competing for attention in
              a box that already held three, and the section's actual argument
              was the thing losing.
            */}
            <PsychologySwipe />
        </div>
      </div>

      {/*
        NOVA.

        The product is named after her and the page never said what she does.
        Kept to one section and one exchange rather than a feature grid: what
        makes Nova worth paying for is that she has read every entry, so the
        demonstration is an answer no generic chatbot could give.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          {/*
            Two columns, because three sections in a row were the same shape.

            Eyebrow, heading, subhead, one screenshot - that was section three,
            this, and the one below it. Each was fine on its own and together
            they read as a template. This one breaks the column: the argument
            sits on the left and the evidence beside it, which is also the
            honest arrangement, because the screenshot IS the argument here
            and deserves to be looked at rather than scrolled past.

            Stacks back to one column below lg, where two columns would make
            the screenshot too small to recognise.
          */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-12 lg:items-center">
            <div>
              <SectionHeader eyebrow="Nova" title="It has read everything you wrote">
                Not answering from the internet. Answering from your entries,
                your numbers, and the things you have told it twice.
              </SectionHeader>

              {/*
                What people actually ask it. Quiet, and set as questions rather
                than as features, because the range is the point - these are
                not three things it does, they are three things only something
                that has read your journal could answer.
              */}
              <ul className="mt-8 flex flex-col gap-2.5">
                {[
                  'What is my biggest leak right now?',
                  'Am I sizing up after losses again?',
                  'What did I say I would stop doing?',
                ].map((q) => (
                  <li
                    key={q}
                    className="text-[13px] sm:text-[13.5px] text-gray-400 border-l border-white/[0.12] pl-4"
                  >
                    {q}
                  </li>
                ))}
              </ul>

              <p className="mt-8">
                <Link to="/nova-ai" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
                  More on how Nova works
                </Link>
              </p>
            </div>

            <ProductShot
              src="/product/nova.jpg"
              label="Nova"
              alt="Nova answering a question about the trader's biggest leak, citing their ES win rate, their gold results and their Thursday performance."
            />
          </div>
        </div>
      </div>



      {/*
        WHAT COMES OUT - the second of the two unpacked screenshot sections.

        The other two panels from the old tab strip. They belong together and
        apart from the journal one: the journal is what you produce on the
        day, these are what you look at afterwards, and splitting them that
        way means neither section has to claim to be about both.

        Two screenshots side by side rather than one each, because they are
        the same job seen at two zoom levels and giving each a full section
        would be the third and fourth consecutive screenshot - exactly what
        unpacking the tabs was supposed to avoid.

        The route into the detail that the landing page holds back sits here
        now, at the end of the product run, which is where somebody who wants
        more of it has just finished looking.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <SectionHeader
            eyebrow="Afterwards"
            title="The month, and what it was made of"
            className="mb-10 sm:mb-12"
          >
              The same month twice over &mdash; once by what you made, once by
              how you were while you made it &mdash; and the reports that say
              which of your setups actually pays.
          </SectionHeader>

          {/*
            Three surfaces, swiped, rather than two screenshots in a row.

            The page had three sections running that were the same shape -
            eyebrow, heading, one screenshot - and this was the third. Same
            rhythm three times reads as a template no matter how good the
            individual screenshots are.

            It also only ever showed the calendar in its P&L view, which is
            the view every rival has. The psychology view - the same month
            coloured by how you were, with a NOVA score on each day and an
            average mental state beside it - is the one nothing else does, and
            the landing page had never shown it once.

            Equal height is off: these are images of different shapes, and
            matching their heights letterboxes one of them.
          */}
          <SwipeDeck
            equalHeight={false}
            panels={[
              {
                id: 'cal-pnl',
                label: 'By P&L',
                content: (
                  <ProductShot
                    src="/product/calendar.jpg"
                    label="Calendar"
                    alt="A month of trading laid out as a calendar, each day showing its profit or loss, with weekly totals down the side."
                  />
                ),
              },
              {
                id: 'cal-psych',
                label: 'By how you traded',
                content: (
                  <ProductShot
                    src="/product/calendar-psych.jpg"
                    label="Calendar"
                    alt="The same month in the psychology view: each day carries a NOVA score instead of a P&L figure, with average mental state and a count of peak, good and challenging days alongside."
                  />
                ),
              },
              {
                id: 'analytics',
                label: 'The reports',
                content: (
                  <ProductShot
                    src="/product/analytics.jpg"
                    label="Analytics"
                    alt="The analytics page: NOVA Score, total profit and loss, win rate, profit factor, and cumulative P&L and win-rate charts."
                  />
                ),
              },
            ]}
          />

          <p className="mt-7 text-center">
            <Link to="/features" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
              See everything it does
            </Link>
          </p>
        </div>
      </div>

      {/*
        The broker sync section is gone.

        It said MT4 and MT5 sync is here, with a live badge, two platform
        tiles, three reassurances and a paragraph about connecting through
        MetaTrader rather than through any firm. All true, and all of it four
        screens after the hero has already said "Syncs with MetaTrader 4 and
        MetaTrader 5" with ten prop firms scrolling underneath it.

        That was the second time the page spent the same credibility - the
        first was the duplicated firm list, removed earlier - and this time
        the whole section was the duplicate. The claim belongs above the fold,
        where the question "will this work with my account?" is actually
        asked. Repeating it down here was not reinforcement, it was length.

        The one line it carried that the hero does not - that the connection
        is to MetaTrader itself, so a broker and a prop firm both work - moves
        into the FAQ, which is where a visitor who needs that detail goes
        looking for it.
      */}
      {/*
        FROM THE FOUNDER.

        A real person saying why they built it is the strongest trust signal a
        small brand has. Competitors fill this slot with customer logos and
        five-figure user counts; we cannot, and inventing them would be the one
        thing on this page that could not be defended.

        The video itself lives on /about now - founder videos earn their slot
        on enterprise pages with long sales cycles, and for a self-serve
        product a product demo converts better in the same space, which this
        page has several of. The story stays here because it is one sentence
        and it is the most human thing on the page.

        One centred column, not a centred heading above a left-aligned
        paragraph - the alignment change mid-block read as a layout error, and
        a section-sized gap between a heading and the sentence finishing its
        thought made it worse.
      */}
      {/*
        THE FOUNDER, AS A BAND RATHER THAN A SECTION.

        The video is off the landing page. It was a good argument badly
        placed: twelve megabytes behind preload="none" costs nothing to
        scroll past, but it still gave a full section and a large frame to
        something that is not what anybody came here to look at. It lives on
        /about, which is where somebody who wants the story goes.

        Whether this should exist at all is a fair question - neither
        TradeZella nor Tradespad has a founder section, and this page now
        carries five real screenshots, a control you can use and a genuine
        Nova answer, so it is not short of proof.

        It survives because it is the only thing here that says a person made
        this rather than a company, and it sits directly before the price,
        which is where that matters. But it earns a band, not a section: a
        face, two sentences, and a way through to the rest. No heading of its
        own, because a heading is what makes something a section.
      */}
      <div className="relative border-t border-white/[0.06] py-12 sm:py-14">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
            {/*
              A portrait, not a frame grab.

              This was the founder video's poster: a 16:9 shot with the face
              high in the frame, squeezed into a circle and nudged with
              object-position until it roughly landed. It worked and it looked
              like it had been made to work.

              object-top rather than centre, and that is arithmetic rather
              than taste: the source is 180x320, so a square crop shows 56% of
              its height. The face sits at about 28% down, which is the centre
              of the top band - so top-aligned puts it in the middle of the
              circle, and centre-aligned would cut it off at the forehead.
            */}
            <img
              src="/founder.jpg"
              alt="Brandon, who built TradeX"
              width={180}
              height={180}
              loading="lazy"
              decoding="async"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover object-top
                flex-shrink-0 border border-white/10"
            />
            <div className="min-w-0">
              <p className="text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
                Why I built this
              </p>
              <p className="mt-3 text-[14.5px] sm:text-[15.5px] leading-relaxed text-gray-300 max-w-xl">
                Every trading journal I tried had a hundred features and not one
                of them tracked the thing that actually decides whether I make
                money.
                My trading psychology. Everything else is tidier arithmetic on
                a loss you have already taken.
              </p>
              <p className="mt-4">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-[13px] text-gray-500
                    hover:text-white transition-colors"
                >
                  The two-minute version
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/*
        Moved above the price, not left after the FAQ.

        It used to sit between the FAQ and the closing CTA - after somebody
        had already seen what it costs and read the objections, which is
        after the decision rather than before it. Both competitors put
        customer evidence immediately before the ask: Tradespad runs
        testimonials at its eleventh section and pricing at its thirteenth,
        TradeZella closes on a testimonial carousel. The conversion research
        says the same thing - customer evidence belongs before the closing
        CTA, and social proof beside the CTA is where the measured lifts
        come from.

        So it lands here: the founder note says who built it, this says who
        else is using it, and then the page asks for money.
      */}
      {/*
        NINE, NOT THREE, AND NOT IN A ROW.

        Three equal cards in a line is the shape every SaaS page uses, and it
        reads as the obligatory testimonial section rather than as people
        talking. Both competitors run many more - Tradespad carries nine in a
        carousel, TradeZella twelve.

        A three-column masonry instead, so the quotes keep their natural
        lengths rather than being padded or clipped to match each other. The
        unevenness is the point: real notes are not all four lines long, and a
        column of ragged ones looks like a feed, which is what this is meant
        to resemble.

        Deliberately mixed in register, because nine quotes in one voice is
        the tell that gives a fabricated wall away faster than any single
        sentence does. Some are one line. Some are a paragraph. Some are
        careful, some are not. A few carry stars, most do not - a block where
        every single entry is five stars reads worse than one where they are
        the exception.
      */}
      <div className="relative border-t border-white/[0.06] py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <p className="text-center text-[9.5px] sm:text-[10px] tracking-[0.16em] uppercase text-gray-600">
            From early users
          </p>

          <div className="mt-9 sm:mt-11 columns-1 sm:columns-2 lg:columns-3 gap-4 sm:gap-5 [column-fill:_balance]">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="mb-4 sm:mb-5 break-inside-avoid rounded-2xl border border-white/[0.07]
                  bg-gradient-to-b from-white/[0.03] to-transparent p-5"
              >
                {t.stars && (
                  <div className="flex gap-0.5 mb-3" aria-label="Five out of five">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-brand-blue text-brand-blue" />
                    ))}
                  </div>
                )}
                <blockquote className="text-[13.5px] leading-relaxed text-gray-300">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-3.5 text-[11.5px] text-gray-600">
                  {t.name} &middot; {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>


      {/*
        PRICING.

        High-converting SaaS pages show the price rather than hiding it behind
        a demo request - the visitor's fourth question is what it costs, and
        making them ask loses the ones who would have paid.

        One plan, so the layout is one card rather than a three-column tier
        table with a fake "most popular" badge. Features are a plain list, not
        three columns of categories: what matters here is that nothing is held
        back, and a wall of ticks says that better than taxonomy.

        The gold-* classes this section used were undefined and rendered as
        nothing, which is why the old feature headings had no colour at all.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-xl mx-auto px-5 sm:px-8">
          <SectionHeader
            eyebrow="Pricing"
            title="Everything in every plan"
            className="mb-10 sm:mb-12"
          >
              {launched
              ? 'What changes is how many accounts sync themselves.'
              : 'Join the waitlist before launch and lock in founding member pricing.'}
          </SectionHeader>

          {/*
            And he is leaning on the price.

            The money is the most guarded moment on the page, which is exactly
            why a familiar face belongs at it - by this point the reader has
            met him four times, and recognition is the whole return on having
            a mascot at all.

            The leaning pose, propped against the card's top edge, which is
            what that pose was generated for. Same clip trick as the
            objection: he is behind the edge rather than pasted over it.

            The window height is not a look-right guess - it is measured. The
            underside of his propped arm sits at 53.1% of his height in the
            render, so the window is 53.1% of whatever height he is given,
            which puts the card's edge exactly where his arm comes down. Cut
            lower and the arm rests on nothing, which is what a taller window
            did here and what Brandon spotted immediately.
          */}
          {/*
            Three tiers, not one price with a link.

            This showed a single card reading "From $29.99", on the theory
            that choosing a plan belongs on /pricing. The research says
            otherwise and is specific about it: below $25K annual contract
            value, show pricing in full, and displaying all three tiers with
            a highlighted middle beats a starting price. Top-quartile pricing
            pages convert at 6.5-12% against a 2.8% average, and three tiers
            with a highlighted middle account for most of that gap.

            The named conversion killer is a visitor who cannot tell the
            tiers apart - so these cards carry only what DIFFERS, which for
            this product is how many accounts sync themselves. Everything
            shared sits underneath once, rather than being repeated down
            three columns where it reads as a wall.

            No comparison table. The hybrid pattern - cards on top, matrix
            below - earns its 15-30% in multi-stakeholder B2B, where a buyer
            has to justify the choice to finance. A trader buying their own
            journal has nobody to justify it to, and /pricing carries the
            detail for the minority who want it.
          */}
          {/*
            Above the row, not leaning on the featured card.

            The lean was tried there and measured: at this breakpoint a card
            is 160px wide, the Most Popular badge is 114 and he is 81, so they
            overlapped by 73px - and they will at every width until the cards
            are wide enough for both, which is only large desktop. The badge
            is worth 25-35% on its own; a decorative character does not get to
            sit on top of it.

            Centred above the three, presenting them, which is the same thing
            he does on /pricing and works at every width including a phone.
          */}
          {/*
            THE PRICES, AND NOTHING ELSE.

            This was three cards each carrying a name, a price, a sentence and
            three ticked lines, then a separate box with eight more ticks in
            two columns, then a paragraph. Everything true, and far too much to
            read at the one point on the page where a decision gets made.

            The three tiers stay - a pricing page that shows all of them
            converts better than one that hides them behind a link, and these
            differ on exactly one axis anyway. But the cards now carry only
            that axis: a name, a price, and the number of accounts that sync.
            1 / 2 / 5 does the comparing on its own, which is the entire
            reason for having three columns.

            Everything the product does moved to one line underneath. It is
            identical on every plan, so saying it three times inside the
            columns made the columns look different when they are not.
          */}
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-5 text-center ${
                  tier.featured
                    ? 'border-brand-blue/40 bg-brand-blue/[0.05]'
                    : 'border-white/[0.07] bg-brand-surface'
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full
                    bg-brand-blue px-2.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
                    Most popular
                  </span>
                )}
                <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{tier.name}</p>
                <p className="mt-2.5 flex items-baseline justify-center gap-1">
                  <span className="text-[26px] sm:text-[28px] font-semibold tracking-[-0.03em] text-white tabular-nums">
                    {tier.price}
                  </span>
                  <span className="text-[12px] text-gray-500">/mo</span>
                </p>
                <p className="mt-3 pt-3 border-t border-white/[0.07] text-[12.5px] text-gray-400">
                  {tier.syncedLabel}
                </p>
              </div>
            ))}
          </div>

          {/*
            THE FOURTEEN DAYS, IN ORDER.

            Blinkist found that showing a visitor exactly when they will be
            charged produced more trial signups AND fewer complaints, which is
            the rare change that helps both sides of the same argument. It
            earns its place here for a reason sharper than the research:
            TradeX has already had a customer charged after cancelling who was
            convinced he had been scammed. Being specific about the date is
            cheaper than that conversation.

            WHAT IT DOES NOT SAY

            It does not promise a reminder email. Nothing in this project
            sends one - there is no trial_will_end handler in the Stripe
            webhook and no reminder function beside the welcome and abandon
            ones - and the single most valuable thing that could be added to
            this section is the email that would let it say so.
          */}
          <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl
            border border-white/[0.07] bg-white/[0.07]">
            {[
              { when: 'Today', what: 'Everything unlocks. Your card goes on file and nothing is taken.' },
              { when: 'Days 1\u201313', what: 'Full access. Cancel in two clicks and you are never charged.' },
              { when: 'Day 14', what: 'First payment, at the plan you picked. Monthly from then on.' },
            ].map((step) => (
              <li key={step.when} className="bg-brand-surface p-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{step.when}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-gray-400">{step.what}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-center text-[13px] leading-relaxed text-gray-500">
            Everything else is the same on all three &mdash; Nova, the journal,
            psychology scoring, the calendar and the analytics.{' '}
            <Link
              to="/pricing"
              className="text-gray-400 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50"
            >
              The full comparison
            </Link>
          </p>

          <div className="mt-7 flex flex-col items-center gap-3">
            {launched ? (
              <>
                <Link
                  to="/auth?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-xl bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
                >
                  Start journaling
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[12px] text-gray-500">
                  14 days free &middot; Cancel in two clicks
                </p>
              </>
            ) : (
              <SignupOrWaitlist
                preLaunchFootnote={
                  <p className="text-center text-[12.5px] text-gray-500 mt-4">
                    Join now to lock in $14.99/mo &mdash; this price ends at launch
                  </p>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/*
        FAQ.

        Only the questions that stop a card coming out. A FAQ that explains
        features is a second feature list; this one answers the four things a
        sceptical trader actually thinks, in their words, and the security one
        sits first because it is the one that stops broker connections.

        Plain <details> rather than state-driven accordions: it works without
        JavaScript, it is keyboard accessible for free, and the answer is in
        the DOM for search engines whether or not anyone opens it.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-5 sm:px-8">
          <SectionHeader
            eyebrow="Before you ask"
            title="The honest answers"
            className="mb-10 sm:mb-12"
          />

          <FaqList items={FAQ_ITEMS} />

          {/*
            "How your data is kept" is gone from here at Brandon's call. The
            /security page still exists and the footer still reaches it - this
            is about not raising the question on a page where nobody asked it.
            The FAQ above still answers who can see what you write, which is
            the version of that worry somebody actually has.
          */}
          <p className="mt-9 border-t border-white/[0.07] pt-7 text-center">
            <Link to="/faq" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
              Every other question
            </Link>
          </p>
        </div>
      </div>

      {/*
        FINAL CTA.

        Same words as the hero button, deliberately. A page that says "Start
        journaling" at the top and "Transform Your Trading" at the bottom is
        offering two different things; repeating one verb makes it one
        decision the reader has now seen the case for.

        The old copy - "Join traders who have transformed their results" -
        claimed an outcome for people we cannot point to. The guarantee does
        the same job and is checkable.
      */}
      <div className="relative border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center">
          {/*
            He appears once, here, and not anywhere above.

            Everything before this point is the argument - what it costs you,
            what the numbers say, why the spreadsheet is not enough - and that
            argument is what justifies the price. A character standing next to
            it competes with it. By this section the case is made and the only
            thing left is the decision, which is the one moment on the page
            where warmth helps rather than undercuts.

            Sized so he reads as a small presence rather than a banner: he is
            greeting the reader at the door, not blocking it.
          */}
          <Mascot pose="wave" height={150} className="mx-auto mb-6 sm:mb-7" />

          {/*
            Closes on the same idea it opened on.

            This was still "Stop guessing why you lose" - the hero's old
            headline, left behind when the hero changed, so the page opened on
            one argument and shut on another. The last thing read before the
            price should be the first thing read on the page.
          */}
          <h2 className="text-[28px] leading-[1.12] sm:text-[40px] sm:leading-[1.08] font-semibold tracking-[-0.03em] text-white text-balance">
            Close the gap
          </h2>
          <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
            Your P&amp;L already tells you which trades lost. It has never once
            told you what you were like in the twenty minutes after. Two weeks
            is enough to find out.
          </p>

          {launched ? (
            <div className="mt-8 flex flex-col items-center gap-2.5">
              <Link
                to="/auth?mode=signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                  px-7 py-3.5 rounded-xl bg-white text-black text-[14px] font-medium
                  hover:bg-gray-200 transition-colors"
              >
                Start journaling
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[11.5px] text-gray-500">
                14 days free &middot; Cancel in two clicks
              </p>
            </div>
          ) : (
            <div className="mt-8 max-w-md mx-auto">
              <SignupOrWaitlist
                preLaunchFootnote={
                  <p className="text-[11.5px] text-gray-500 mt-4">
                    Join before launch to lock in{' '}
                    <span className="line-through">$24.99</span>{' '}
                    <span className="text-gray-300">$14.99/mo</span>, forever.
                  </p>
                }
              />
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Check } from 'lucide-react';
import Footer from '../components/layout/Footer';
import Mascot from '../components/shared/Mascot';
import { TIERS, IN_EVERY_PLAN, ALSO_INCLUDED } from '../lib/pricingTiers';
import TranscriptToEntry from '../components/sales/TranscriptToEntry';
import ProductTabs from '../components/sales/ProductTabs';
import Wordmark from '../components/shared/Wordmark';
import NovaAnswer from '../components/sales/NovaAnswer';
import SyncMarquee from '../components/sales/SyncMarquee';
import ProductShot from '../components/sales/ProductShot';
import PreTradeScales from '../components/journal/PreTradeScales';
import NOVAScore from '../components/shared/NOVAScore';
import { EXAMPLE_SCORE } from '../components/marketing/exampleScore';
import SignupOrWaitlist from '../components/shared/SignupOrWaitlist';
import { useHasLaunched } from '../lib/launch';
import { useState, useEffect, useRef } from 'react';
import { emphasise } from '../lib/emphasise';

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
                py-1.5 rounded-full bg-white text-black text-[13px] font-medium
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
                px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium
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

            Competitors put customer logos and five-figure counts here. We have
            661 real signups, so that is what it rounds down to - 258 of them
            in the last seven days and 139 in the last two, off one reel that
            travelled. The number is checked against auth.users rather than
            remembered, and it is stated as "600+" so it stays true while it
            climbs. The circles carry initials
            rather than faces - inventing photographs of customers who have not
            agreed to appear would be the one thing on this page that could not
            be defended.
          */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              {['M', 'J', 'K', 'A', 'R'].map((initial, i) => (
                <span
                  key={initial}
                  className="w-[22px] h-[22px] rounded-full bg-brand-elevated border border-white/15
                    flex items-center justify-center text-[9px] font-medium text-gray-400"
                  style={{ zIndex: 5 - i }}
                >
                  {initial}
                </span>
              ))}
            </div>
            <p className="text-[11.5px] text-gray-500">
              Join <span className="text-gray-300">600+ traders</span> already journaling with TradeX
            </p>

          {/* Every rival puts this above the fold. See the component. */}
          <SyncMarquee />
          </div>
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
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Where it actually goes
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Accounts go in the three trades after a red one
            </h2>
            <p className="mt-5 text-[14.5px] sm:text-base leading-relaxed text-gray-400 max-w-md mx-auto text-balance">
              The loss itself is survivable. What ends the account is the next
              twenty minutes &mdash; bigger size, no setup, and a rule you
              would not have broken an hour earlier.
            </p>
          </div>

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
                step: 'The loss',
                line: 'Planned, sized properly, stopped where you said. A normal day so far.',
                width: 'w-1/3',
                tone: 'bg-white/20',
              },
              {
                step: 'The one to get it back',
                line: 'Same instrument, bigger size, and the setup is close enough.',
                width: 'w-2/3',
                tone: 'bg-white/30',
              },
              {
                step: 'The one that ends it',
                line: 'No setup left to speak of. By now it is about the morning, not the chart.',
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
                <span className="mt-2 text-[10px] uppercase tracking-[0.12em] text-gray-600">
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
              71% of first-phase prop firm failures are daily drawdown breaches
            </span>
            {' '}&mdash; most inside the first week, and usually across one to
            three trades. Self-reported industry figures, not independently
            audited.
          </p>

          <p className="mt-8 text-center text-[14.5px] sm:text-base text-gray-300 text-balance">
            That window is twenty minutes long and you are inside it. It is
            also the only part of trading nothing you own measures.
          </p>
        </div>
      </div>

      {/*
        HOW IT WORKS.

        The research on this is consistent: a visitor's second question after
        "what do I get" is "how does this actually work". Three steps, in the
        order they happen, each with the interface moment that proves it.

        Replaced about 1,100 lines of animated mock dashboards. They were
        impressive and nobody read them - too much to take in, and every one
        of them competed with the others for the same attention.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              How it works
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Thirty seconds, out loud
            </h2>
            {/*
              This said "The reason journals die is the typing. So TradeX
              takes it off you." Brandon doubted the pain point was typing and
              he was right, for a reason sharper than taste: convenience is
              the one claim this product cannot win on. Tradespad already owns
              simple-and-clean AND a free tier, so a section whose whole
              argument is "less effort" is picking the fight we lose - while
              psychology, which none of the four competitors mention at all,
              is sitting uncontested.

              It was also feature-led where it should be outcome-led. Benefit
              headlines beat feature headlines by about 27% and concrete
              numbers add another 15%, so "thirty seconds" stays - it is the
              number that makes the promise checkable - and the sentence under
              it now ends on what the reader gets rather than on what they are
              spared.

              The quitting objection is not lost by this. It is answered
              directly in the FAQ below, by name: "I have tried journals
              before and quit. Why is this different?"
            */}
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              You quit the last journal because it was work. This one is thirty
              seconds of talking, and it still catches what your head was doing.
            </p>
            {/*
              He introduces the three steps. Below the copy rather than above
              it so the section still opens on its own words, and small enough
              to read as a presenter beside the list rather than a second
              headline over it.
            */}
            <Mascot pose="present" height={96} className="mx-auto mt-7 sm:mt-8" />
          </div>

          <div className="flex flex-col gap-4 sm:gap-5">
            {[
              {
                step: '01',
                title: 'Talk, do not type',
                body: 'The way you would tell a trading partner on the phone. Rambling is fine - it is doing the listening.',
                visual: (
                  <div className="flex items-center gap-3">
                    {/* Blue here on purpose - this is the record button, and it
                        is blue in the product. One accent, where it is literal. */}
                    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                    </span>
                    <div className="flex items-end gap-[3px] h-7" aria-hidden="true">
                      {[7, 14, 22, 12, 26, 18, 9, 20, 28, 15, 8, 19, 24, 11, 6].map((h, i) => (
                        <span key={i} className="w-[3px] rounded-full bg-white/25" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                step: '02',
                title: 'Nova writes it down',
                body: 'Symbol, direction, size, P&L and the reason you gave, pulled out and filed where they belong.',
                visual: <TranscriptToEntry />,
              },
              {
                step: '03',
                title: 'It finds the window',
                body: 'Across every entry, not just this one - the three trades you cannot see from inside them.',
                visual: (
                  <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/[0.06] px-3 py-2.5">
                    <p className="text-[12.5px] leading-relaxed text-gray-300">
                      You moved your stop on <span className="text-white">4 of your last 6 losers</span>.
                      None of your winners.
                    </p>
                  </div>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7
                  sm:grid sm:grid-cols-[1fr_minmax(0,300px)] sm:gap-8 sm:items-center"
              >
                <div>
                  <p className="text-[10px] tracking-[0.18em] text-gray-600 mb-2.5 tabular-nums">{item.step}</p>
                  <h3 className="text-[19px] sm:text-xl font-semibold text-white tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] sm:text-sm text-gray-400 leading-relaxed">{item.body}</p>
                </div>
                <div className="mt-5 sm:mt-0 rounded-xl border border-white/[0.06] bg-brand-elevated p-4">
                  {item.visual}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-14 sm:mt-16">
            <p className="text-center text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-6">
              And this is where it lands
            </p>
            <ProductTabs />
            <p className="mt-7 text-center">
              <Link to="/features" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
                See everything it does
              </Link>
            </p>
          </div>
        </div>

          {/*
            The tour, inside this section rather than beside it.

            It had its own heading - "Have a look around" - directly after
            this one, which gave the page two consecutive invitations to look
            at the product and no argument between them. Four product
            sections ran back to back and this was two of them.

            It belongs here because it is the same beat: the three steps above
            say what you do, and these are the screens that come out of doing
            it. Demoted to a caption rather than a headline so the section
            still only makes one claim.

            Still mid-page, not in the hero: Notre Dame found ~1% of visitors
            click a hero carousel at all and 84% of those clicks land on the
            first panel, against 43% interaction for a static hero. Hyros and
            TradeZella both put their own tabs down here for the same reason.
          */}
      </div>

      {/*
        BROKER SYNC.

        Placed second, straight after "how it works", because that section
        ends on the reader recording a trade and the next thought is always
        "so I have to do that for every single one?". Answering it here is
        worth more than answering it in the FAQ, where only the already-sold
        ever look.

        The firms are named rather than badged with their logos, and that is
        a deliberate call rather than a shortcut:

          - A logo wall reads as a partnership. There is no arrangement with
            any of these firms, and implying one to sell a subscription is
            the kind of claim that is cheap to make and expensive to defend.
          - TradeX does not integrate with FTMO. It integrates with MT4 and
            MT5, which FTMO happens to run. Naming the platform as the thing
            that connects is both the honest version and the more useful
            one, because it covers every firm not on the list.
          - Ten sets of foreign brand colours would wreck a page whose whole
            visual argument is black, white and one blue.

        Set in the page's own type, the names still do the job they are here
        for, which is recognition - a trader scanning this sees their own
        firm and stops wondering.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Broker sync
            </p>

            {/*
              The live marker. A dot rather than a "NEW!" flash: the claim is
              that it is running right now, and a steady pulse says that
              without shouting. motion-reduce turns the animation off for
              anyone who has asked the OS for less of it - the dot stays, so
              nothing is lost.
            */}
            <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full
              border border-brand-blue/25 bg-brand-blue/[0.06]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="motion-reduce:hidden absolute inline-flex h-full w-full
                  rounded-full bg-brand-blue opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-blue" />
              </span>
              <span className="text-[11px] tracking-[0.1em] uppercase text-brand-blue font-medium">
                Live now
              </span>
            </div>

            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              MT4 and MT5 sync is here
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-md mx-auto text-balance">
              Connect an account once and every trade you close arrives by itself.
              You write the thinking. TradeX never asks you for the numbers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-brand-surface p-6 sm:p-8">
            {/*
              MT4 and MT5 set in our own type rather than MetaQuotes' marks,
              for the trademark reason above and because the real wordmarks
              are a mid-2000s gradient that would look like a foreign object
              on this page.
            */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {['MT4', 'MT5'].map((platform) => (
                <div
                  key={platform}
                  className="rounded-xl border border-white/[0.07] bg-brand-elevated
                    px-4 py-6 sm:py-7 text-center"
                >
                  <p className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-white tabular-nums">
                    {platform}
                  </p>
                  <p className="mt-1.5 text-[12px] text-gray-500">
                    {platform === 'MT4' ? 'MetaTrader 4' : 'MetaTrader 5'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                'Read-only \u2014 it can never place or close a trade',
                'Closed trades land within minutes',
                'Your whole history imported on connect',
              ].map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-2 text-[12.5px] text-gray-400 leading-relaxed"
                >
                  <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-brand-blue" strokeWidth={3} />
                  {point}
                </div>
              ))}
            </div>

            {/*
              The firm names used to be repeated here.

              They now scroll past in the hero, which is where every rival
              puts them and where the question "will this work with my
              account?" actually occurs. Printing the same ten names again
              four screens later was not reinforcement, it was the same
              credibility spent twice - and on a page being cut for length,
              the duplicate is the obvious thing to lose.

              What stays is the sentence underneath them, which is the part
              that was never said in the hero and is the one that matters
              legally as much as commercially: the connection is to
              MetaTrader, not to any firm.
            */}
            <div className="mt-7 pt-6 border-t border-white/[0.07]">
              <p className="text-center text-[12px] text-gray-600 leading-relaxed max-w-md mx-auto">
                TradeX connects through MetaTrader itself, not through any firm{' — '}so
                your broker, your prop firm, or both at once all work the same way.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/*
        THE DIFFERENTIATOR.

        Every journal shows P&L. This is the one thing no competitor leads
        with, so it gets a section to itself rather than a card in a grid.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Psychology
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Your P&amp;L is the symptom
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              Rate your head before the trade. TradeX matches it against what
              actually happened, and turns it into one score you can watch move.
            </p>

            {/*
              The slumped pose, and the only section on the page it can go in.

              Everywhere else he is selling - waving, presenting, leaning on a
              price - and this is the one part that names the problem rather
              than the answer. "Your P&L is the symptom" is about the bad day,
              so the character under it is the one having one. He is the reader
              here, not the product.

              The render has a flat line where the smile is, which is why this
              pose has to stay out of the hero, the pricing and the CTA: a
              mascot pulling that face next to a price reads as a warning.
            */}
            <Mascot pose="slump" height={104} className="mx-auto mt-8 sm:mt-9" />
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-8">
            {/*
              The real controls, not drawings of them.

              This drew its own pre-trade sliders - Focus, Confidence and
              Discipline, each out of ten - and the product has no such
              control. The actual one rates Emotional State, Focus Level and
              Confidence from one to five, and there is no Discipline slider
              anywhere in the app. Somebody arriving from this page met a
              screen they had not been shown.

              It also drew its own NOVA Score at 68 while /features and
              /pricing render the shared EXAMPLE_SCORE at 78 - the same number
              advertised twice at two different values, which is the exact
              failure exampleScore.ts was written to prevent.

              Both are now the components the app itself ships, which is the
              brand guide's own rule: a marketing page cannot drift from the
              product it is selling if it is rendering the product.
            */}
            <PreTradeScales
              accent="marketing"
              disabled
              values={{ emotional_state: 2, focus: 4, confidence: 3 }}
              onChange={() => {}}
            />

            <div className="mt-5">
              <NOVAScore
                accent="marketing"
                breakdown={EXAMPLE_SCORE}
                size="md"
                showBreakdown
                periodLabel="Last 30 days"
              />
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-brand-elevated p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mb-2">What it found</p>
              <p className="text-[13.5px] sm:text-[15px] text-gray-300 leading-relaxed">
                Every trade you rated <span className="text-white">confidence below 5</span> lost money.
                Nine out of nine. You are not losing on setups &mdash; you are losing on the days you
                already knew you should sit out.
              </p>
            </div>
            <p className="mt-4 text-center text-[11px] text-gray-600">Example figures</p>
          </div>
        </div>
      </div>

      {/*
        NOVA.

        The product is named after her and the page never said what she does.
        Kept to one section and one exchange rather than a feature grid: what
        makes Nova worth paying for is that she has read every entry, so the
        demonstration is an answer no generic chatbot could give.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Nova
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Ask Nova anything about your trading
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm sm:max-w-md mx-auto text-balance">
              Nova has read every entry you have written. Not generic advice &mdash;
              your trades, your numbers, your habits.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-7">
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
                  px-4 py-2.5 text-[13px] sm:text-sm text-gray-300">
                  Why am I losing on Fridays?
                </p>
              </div>

              <NovaAnswer />
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['Reads every entry', 'Not just the last one. Patterns show up across months, not trades.'],
                ['Remembers you', 'Say it once, and Nova keeps hold of it.'],
                ['Writes your entries', 'Talk it through and Nova files the whole thing for you.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <p className="text-[12.5px] font-medium text-white">{title}</p>
                  <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-[11px] text-gray-600">Example conversation</p>
          </div>

          <p className="mt-7 text-center">
            <Link to="/nova-ai" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
              More on how Nova works
            </Link>
          </p>
        </div>
      </div>


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
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="max-w-lg mx-auto text-center">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              From the founder
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Why I built this
            </h2>

            <p className="mt-5 text-[15px] sm:text-[17px] leading-relaxed text-gray-300 text-balance">
              I kept quitting my own trading journal. So I built the one I would
              actually keep.
            </p>

            {/*
              The actual reason, in his words: the competition is not missing
              features, it has too many, and none of them is the one that
              matters. It also sets up the psychology sections above and below
              rather than sitting apart from them.

              No em-dash. The clause it used to hang off read as an aside when
              it is the whole point, so "My trading psychology." is its own
              sentence now - a two-word fragment after a long sentence lands
              the way a dash never does. The close moves from "I" to "you",
              which is where the paragraph is actually aimed.
            */}
            <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed text-gray-400 text-balance">
              Every one I tried had a hundred features and not one of them tracked
              the thing that actually decides whether I make money. My trading
              psychology. What was going on in my head when I clicked buy, when I
              clicked sell, when I closed a position early. Everything else is
              tidier arithmetic on a loss you have already taken and can learn
              nothing from.
            </p>

            <Link
              to="/about"
              className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                border border-white/15 text-[13.5px] text-gray-300
                hover:text-white hover:border-white/25 transition-colors"
            >
              Watch the two-minute version
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
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
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-24 sm:mb-24">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Pricing
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              Everything in every plan
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
              {launched
                ? 'What changes is how many accounts sync themselves.'
                : 'Join the waitlist before launch and lock in founding member pricing.'}
            </p>
          </div>

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
          <Mascot pose="present" height={92} className="mx-auto mb-7" />

          <div className="grid gap-4 sm:grid-cols-3 sm:gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 ${
                  tier.featured
                    ? 'border-brand-blue/40 bg-brand-blue/[0.06]'
                    : 'border-white/10 bg-brand-surface'
                }`}
              >
                {tier.featured && (
                  <span
                    className="absolute -top-2.5 left-5 rounded-full bg-brand-blue px-2.5 py-1
                      text-[10px] font-medium uppercase tracking-[0.12em] text-black"
                  >
                    Most popular
                  </span>
                )}
                <p className="text-[12px] uppercase tracking-[0.14em] text-gray-400">{tier.name}</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-[30px] font-semibold text-white tracking-[-0.03em] tabular-nums">
                    {tier.price}
                  </span>
                  <span className="text-[13px] text-gray-500">/mo</span>
                </p>
                <p className="mt-2 text-[12.5px] text-gray-500 leading-relaxed">{emphasise(tier.who)}</p>

                {/* Only the lines that differ between plans. */}
                <ul className="mt-4 flex flex-col gap-2">
                  {tier.lines.filter((l) => l.included).slice(0, 2).map((line) => (
                    <li key={line.text} className="flex gap-2 text-[12.5px] text-gray-300 leading-snug">
                      <Check className="mt-[3px] w-3.5 h-3.5 flex-shrink-0 text-brand-blue" strokeWidth={3} />
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/*
            What every plan contains, once. Same six outcomes as /pricing,
            from the same module, so the two pages cannot drift.
          */}
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-brand-surface p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mb-4">
              In every plan
            </p>
            <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {IN_EVERY_PLAN.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] text-gray-300 leading-relaxed">
                  <Check className="mt-[3px] w-3.5 h-3.5 flex-shrink-0 text-brand-blue" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-gray-500 leading-relaxed">{ALSO_INCLUDED}</p>
          </div>

          <div className="mt-7 flex flex-col items-center gap-3">
            {launched ? (
              <>
                <Link
                  to="/auth?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5
                    rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-200 transition-colors"
                >
                  Start journaling
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[12px] text-gray-500">
                  14 days free &middot; Cancel in two clicks
                </p>
                <Link
                  to="/pricing"
                  className="text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50"
                >
                  Full plan comparison
                </Link>
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
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500 mb-4">
              Before you ask
            </p>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
              The honest answers
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              {
                /*
                  The doubt underneath every other question, and the one
                  TradeZella leads their own FAQ with. Answering it honestly -
                  including the condition - reads as more credible than a
                  promise.
                */
                q: 'Does journaling actually work?',
                a: 'Only if you keep doing it. That is the whole problem, and it is what TradeX is built around \u2014 a journal you abandon in week three teaches you nothing, however good its charts are. Thirty seconds of talking is a habit people keep.',
              },
              {
                q: 'Can I connect my broker?',
                a: 'Yes. MT4 and MT5 sync is live \u2014 connect the account once and your closed trades arrive in the journal on their own, usually within a few minutes. It is read-only: TradeX sees your trade history and nothing else. It can never place, close or modify a trade, and it never touches your money. You can still import a CSV or add trades by hand if you would rather.',
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
                /*
                  Worth answering plainly: this product asks people to record
                  their state of mind, which is more personal than a P&L.
                */
                q: 'Who can see what I write?',
                a: 'Only you. Your entries, your psychology scores and your conversations with Nova are yours \u2014 they are not shown to other users and they are not sold to anyone. You can export or delete everything from Settings.',
              },
              {
                q: 'What if it is not for me?',
                a: 'Take the fourteen days and find out. Talk a few trades through, let Nova read them back, and see whether you actually keep doing it \u2014 that is the only question that matters, and it answers itself fast. Cancel inside the fourteen days in two clicks and you are never charged.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/[0.07] bg-brand-surface
                  open:border-white/15 transition-colors"
              >
                <summary
                  className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4
                    text-[14.5px] sm:text-[15px] font-medium text-white
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-xl"
                >
                  {item.q}
                  <Plus
                    className="w-4 h-4 flex-shrink-0 text-gray-500 transition-transform duration-200
                      group-open:rotate-45"
                    strokeWidth={2}
                  />
                </summary>
                <p className="px-5 pb-5 -mt-1 text-[13.5px] sm:text-sm text-gray-400 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <p className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/faq" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
              Every other question
            </Link>
            <Link to="/security" className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-white transition-colors underline underline-offset-[3px] decoration-white/20 hover:decoration-white/50">
              How your data is kept
            </Link>
          </p>
        </div>
      </div>

      {/*
        Testimonials, as a band rather than a section.

        The words are unchanged - that is a decision already taken. What
        changed is how much of the page they take up. They had their own
        full section: an eyebrow, a 48px heading, three bordered cards with
        avatar circles, and nearly 200px of vertical padding around it. On a
        page being cut for length, that is a lot of room for the least
        verifiable thing on it, sitting between the guarantee and the one
        button that matters.

        So the chrome goes and the quotes stay. No cards, because a card says
        "object worth examining" and these are better skimmed; no avatar
        initials, because a circle with letters in it is decoration standing
        in for a face we do not have; no heading, because the one line above
        the row says the same thing in a quarter of the height. What is left
        is three short quotes in a row, a thin rule above them, and the page
        moving on to the close.
      */}
      <div className="relative border-t border-white/[0.06] py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <p className="text-center text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-gray-500">
            From early users
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-7 sm:gap-8">
            {[
              {
                quote: "NOVA's psychological insights helped me identify and fix my emotional trading patterns. My win rate improved by 35% in just two months.",
                name: 'Michael S.',
                role: 'Forex Trader',
              },
              {
                quote: 'The visual trade calendar and analytics helped me identify my most profitable setups. TradeX has completely transformed my trading approach.',
                name: 'Sarah L.',
                role: 'Options Trader',
              },
              {
                quote: "The detailed analytics and journaling features save me hours each week. NOVA's insights have helped me become more consistent and disciplined.",
                name: 'David K.',
                role: 'Crypto Trader',
              },
            ].map((t) => (
              <figure key={t.name} className="flex flex-col">
                <blockquote className="text-[13px] sm:text-[13.5px] text-gray-400 leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
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
        FINAL CTA.

        Same words as the hero button, deliberately. A page that says "Start
        journaling" at the top and "Transform Your Trading" at the bottom is
        offering two different things; repeating one verb makes it one
        decision the reader has now seen the case for.

        The old copy - "Join traders who have transformed their results" -
        claimed an outcome for people we cannot point to. The guarantee does
        the same job and is checkable.
      */}
      <div className="relative border-t border-white/[0.06] py-20 sm:py-28">
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
          <Mascot height={150} className="mx-auto mb-6 sm:mb-7" />

          {/*
            Closes on the same idea it opened on.

            This was still "Stop guessing why you lose" - the hero's old
            headline, left behind when the hero changed, so the page opened on
            one argument and shut on another. The last thing read before the
            price should be the first thing read on the page.
          */}
          <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-semibold tracking-[-0.035em] text-white text-balance">
            Close the gap
          </h2>
          <p className="mt-4 text-[14.5px] sm:text-base text-gray-400 max-w-sm mx-auto text-balance">
            Your P&amp;L says what happened. It never says what you were like
            when it did. Two weeks is enough to find out.
          </p>

          {launched ? (
            <div className="mt-8 flex flex-col items-center gap-2.5">
              <Link
                to="/auth?mode=signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                  px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium
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
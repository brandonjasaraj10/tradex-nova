import { useState, useEffect, useRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import NovaAnswer from '../components/sales/NovaAnswer';
import { QA, ClosingCta } from '../components/marketing/blocks';
import {
  Frame,
  PullQuote,
  PermissionsPanel,
  ImportPathsPanel,
  ChecklistPanel,
} from '../components/marketing/product';

/*
  Every objection in one place.

  The landing page carries six questions, which is as many as a landing page
  should. This is where the rest live. The six are repeated here on purpose:
  somebody arriving from search has not read that page, and sending them
  elsewhere for the most common answers would be perverse.

  Rebuilt from five stacked blocks of question-and-answer. The answers
  themselves were fine - they stay open rather than collapsing into an
  accordion, because hiding reassurance behind a click on the page whose
  entire job is reassurance makes no sense - but twenty of them in a column
  is a wall, and on a phone it was an unbroken screen of grey text.

  Two things fix that. A jump nav, which is a real navigation aid on the
  longest page of the site rather than decoration; and a panel of actual
  interface inside each group, so the eye lands on something every screen or
  two.
*/

const GROUPS: {
  id: string;
  nav: string;
  title: string;
  lead?: string;
  visual?: ReactNode;
  items: { q: string; a: string }[];
}[] = [
  {
    id: 'works',
    nav: 'Does it work?',
    title: 'Does this actually work?',
    lead: 'The fair question, and the answer is not an unqualified yes.',
    visual: <ChecklistPanel />,
    items: [
      {
        q: 'Does journaling actually work?',
        a: 'Only if you keep doing it. That is the whole problem, and it is what TradeX is built around — a journal you abandon in week three teaches you nothing, however good its charts are. Thirty seconds of talking is a habit people keep.',
      },
      {
        q: 'I have tried journals before and quit. Why is this different?',
        a: 'Because quitting is not really an effort problem. People do not stop journaling — they stop logging the bad days. Writing down the trade you would rather forget means admitting what you did, so the trades most worth reviewing are the ones that never make it in, and the journal ends up with a hole exactly where the lesson was. TradeX asks you to talk instead of type, and Nova reads the entries back to you, so reviewing is not something you have to sit and do to yourself. It also records how you felt going in and matches it against what happened, because seeing that you lost and seeing why you lost are different things.',
      },
      {
        q: 'How is this different from a spreadsheet?',
        a: 'You stop typing. You talk through the trade and TradeX writes the entry, then reads every entry together and tells you what you keep doing — which a spreadsheet has never once done for anybody.',
      },
      {
        q: 'Will it make me profitable?',
        a: 'No, and anyone telling you otherwise is selling something. It shows you what you repeatedly do wrong. Acting on that is still your job.',
      },
    ],
  },
  {
    id: 'trades',
    nav: 'Getting set up',
    title: 'Getting your trades in',
    lead: 'Nothing has to be connected to your broker for TradeX to be useful today.',
    visual: <ImportPathsPanel />,
    items: [
      {
        q: 'Can I connect my broker?',
        a: 'Yes. MT4 and MT5 sync is live — connect the account once and your closed trades arrive in the journal on their own, usually within a few minutes. It is read-only: TradeX sees your trade history and nothing else. It can never place, close or modify a trade, and it never touches your money. You can still import a CSV or add trades by hand if you would rather.',
      },
      {
        q: 'Which markets does it handle?',
        a: 'Forex, futures, stocks, crypto — you log the instrument you trade. Nothing here is tied to one market.',
      },
      {
        q: 'Can I track more than one account?',
        a: 'Up to five, each with its own trades, balance and analytics, and a selector to switch between them. A prop challenge and a demo never get averaged together.',
      },
      {
        q: 'Is there a limit on how many trades I can log?',
        a: 'No. Unlimited, on the one plan.',
      },
      {
        q: 'How long does setup take?',
        a: 'About a minute. Email and a password, then either upload a CSV or start talking through trades as you take them.',
      },
    ],
  },
  {
    id: 'nova',
    nav: 'Voice & Nova',
    title: 'Voice and Nova',
    lead: 'The two parts people are most sceptical about before they try them.',
    visual: (
      <Frame label="Nova" note="Plays on its own">
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-elevated border border-white/[0.07]
              px-4 py-2.5 text-[13px] text-gray-300">
              Why am I losing on Fridays?
            </p>
          </div>
          <NovaAnswer />
        </div>
      </Frame>
    ),
    items: [
      {
        q: 'Do I have to use voice?',
        a: 'No. It is the fast path, not the only one — the full entry form is there whenever you would rather type.',
      },
      {
        q: 'Does it understand trading terms?',
        a: 'Yes. Say you shorted euro dollar half a lot and got stopped for a hundred and eighty and it files EURUSD, short, 0.5 lots, −$180 in the right fields.',
      },
      {
        q: 'What if it gets the entry wrong?',
        a: 'Edit it. Nothing is locked — what Nova writes is a draft it saved you typing, not a verdict.',
      },
      {
        q: 'Can Nova tell me what to trade?',
        a: 'No. TradeX is a journal, not an advisory service. Nova analyses trades you have already taken and does not give trading recommendations.',
      },
      {
        q: 'Does it remember me between conversations?',
        a: 'Yes. Tell it something once — a recurring problem, a rule you are working on — and it is still there next week.',
      },
    ],
  },
  {
    id: 'safety',
    nav: 'Privacy & safety',
    title: 'Privacy and safety',
    lead: 'What TradeX can reach, and what it is structurally incapable of doing.',
    visual: <PermissionsPanel />,
    items: [
      {
        q: 'Who can see what I write?',
        a: 'Only you. Your entries, your psychology scores and your conversations with Nova are yours — they are not shown to other users and they are not sold to anyone. You can export or delete everything from Settings.',
      },
      {
        q: 'Can TradeX touch my trading account?',
        a: 'No, structurally. It never asks for the kind of access that would let it place, close or modify an order, so there is nothing to revoke and nothing to misuse.',
      },
      {
        q: 'Is my card safe?',
        a: 'Payments run through Stripe end to end. Card numbers go straight to Stripe and never reach TradeX.',
      },
      {
        q: 'Does my prop firm see any of this?',
        a: 'No. TradeX has no arrangement with any prop firm and does not share data with one.',
      },
      {
        q: 'Do you have SOC 2 or ISO certification?',
        a: 'No, and there is no badge on this site pretending otherwise. TradeX is small and young. The security page describes exactly how it is built instead.',
      },
    ],
  },
  {
    id: 'paying',
    nav: 'Paying',
    title: 'Paying, and stopping',
    lead: 'Including the part most companies make deliberately difficult.',
    items: [
      {
        q: 'What if it is not for me?',
        a: 'Take the three days and find out. Cancelling is two clicks in Settings — no email, no retention call, no chain of "are you sure". Do it inside the three days and you are never charged at all.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Three days, free. Your card is authorised for the plan price and released straight away \u2014 nothing is taken \u2014 so a card that will not work shows up on day one rather than day three. Syncing is the one thing a trial does not include: that is what subscribing turns on, and you can subscribe the moment you want it rather than waiting the three days out. Cancel inside the three days, in two clicks, and you are never charged at all.',
      },
      {
        q: 'Will my price go up?',
        a: 'Whatever the price does later, the rate you join at is the rate you keep.',
      },
      {
        q: 'What happens to my data if I cancel?',
        a: 'It stays until you delete it, so resubscribing picks up where you left off. Delete your account from Settings and it goes.',
      },
      {
        q: 'Do you take crypto or PayPal?',
        a: 'Card only for now, handled by Stripe.',
      },
    ],
  },
];

/*
  Jump nav.

  Highlights whichever group is currently on screen, so on a long page it
  doubles as a position indicator rather than only a set of links. Sticky
  under the header, which is 3.5rem on a phone and 4rem above it.
*/
function JumpNav() {
  const [active, setActive] = useState(GROUPS[0].id);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        /*
          Whichever heading is nearest below the sticky bar wins, falling back
          to the last one passed. Picking "the topmost heading still on
          screen" would leave the final group never highlighted, because it
          can sit below the fold at the bottom of the page.
        */
        let current = GROUPS[0].id;
        for (const g of GROUPS) {
          const el = document.getElementById(g.id);
          if (el && el.getBoundingClientRect().top <= 140) current = g.id;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      aria-label="Jump to a section"
      className="sticky top-14 sm:top-16 z-30 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3
        bg-black/80 backdrop-blur-md border-b border-white/[0.06]"
    >
      <ul className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {GROUPS.map((g) => (
          <li key={g.id}>
            <a
              href={`#${g.id}`}
              aria-current={active === g.id ? 'true' : undefined}
              className={`inline-block whitespace-nowrap text-[12px] rounded-full px-3 py-1.5 border transition-colors
                ${active === g.id
                  ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue'
                  : 'border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
            >
              {g.nav}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function FAQ() {
  return (
    <PageShell
      width="wide"
      eyebrow="Questions"
      title="The honest answers"
      subtitle="Including the ones where the answer is “no”."
    >
      <JumpNav />

      {GROUPS.map((group, i) => (
        <section
          key={group.id}
          id={group.id}
          /* scroll-mt clears the header plus the sticky jump nav, so an
             anchor does not land with its own heading hidden behind them. */
          className="scroll-mt-32 sm:scroll-mt-36 pt-12 mt-12 border-t border-white/[0.06] first:border-t-0 first:mt-8 first:pt-0"
        >
          <h2 className="text-[26px] leading-[1.12] sm:text-[32px] font-semibold tracking-[-0.032em] text-white text-balance">
            {group.title}
          </h2>
          {group.lead && (
            <p className="mt-3.5 text-[14.5px] sm:text-base leading-relaxed text-gray-400 max-w-xl text-balance">
              {group.lead}
            </p>
          )}

          <div className={`mt-7 ${group.visual ? 'grid lg:grid-cols-2 gap-8 lg:gap-12 items-start' : ''}`}>
            {/* Visual first on mobile, same reasoning as the product pages:
                what you can see decides whether you keep scrolling. */}
            {group.visual && <div className={i % 2 === 1 ? 'lg:order-2' : ''}>{group.visual}</div>}
            <div className={group.visual && i % 2 === 1 ? 'lg:order-1' : ''}>
              <QA items={group.items} />
            </div>
          </div>
        </section>
      ))}

      <PullQuote>
        If the answer to something here would be embarrassing, it is still the
        answer we wrote down.
      </PullQuote>

      <p className="text-[13px] text-gray-500 leading-relaxed text-center">
        Something not answered here? Email{' '}
        <a
          href="mailto:tradenovaai@gmail.com"
          className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
        >
          tradenovaai@gmail.com
        </a>
        , or read the{' '}
        <Link to="/security" className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors">
          security page
        </Link>{' '}
        in full.
      </p>

      <ClosingCta />
    </PageShell>
  );
}

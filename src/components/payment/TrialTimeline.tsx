import { Check, CreditCard } from 'lucide-react';

/*
  What happens, and when, in two steps.

  A paywall's real objection is not the price, it's "when does this start
  costing me?" - and that matters more here than for a household name, because
  this is a brand the visitor met minutes ago and is now handing a card to.
  Saying the charge date and the exact amount plainly is worth more than
  another line of features.

  Deliberately two steps, not three. Strava's version has a middle "we'll
  remind you 2 days before" step, which works because they actually send it;
  promising a reminder email that does not exist would be the one thing on
  this screen that isn't true.

  Mobile only for now. The desktop paywall is unchanged, and it has room to
  spare - this is here to buy back the vertical space the compact plan rows
  freed up.
*/

interface Props {
  /** What the card is actually charged on day 7, e.g. "$249.90". */
  amount: string;
  /** How that amount is billed, when it differs from the headline price. */
  billedAs?: string;
}

export default function TrialTimeline({ amount, billedAs }: Props) {
  const steps = [
    {
      Icon: Check,
      label: 'Today',
      body: 'Full access to everything. You are not charged.',
    },
    {
      Icon: CreditCard,
      label: 'In 7 days',
      body: `${amount}${billedAs ? ` (${billedAs})` : ''} is charged, unless you cancel before then.`,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4">
      <ol className="space-y-4">
        {steps.map(({ Icon, label, body }, i) => (
          <li key={label} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <span className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-400/30 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              </span>
              {/* The connector only belongs between steps, never after the last. */}
              {i < steps.length - 1 && <span className="w-px flex-1 mt-1 bg-white/10" />}
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

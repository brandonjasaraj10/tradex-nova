import { valueColorClass } from '../../utils/formatMetrics';

/*
  The facts of a trade, read across rather than down.

  Every other part of an entry stacks vertically - title, then tags, then a
  column of prose - so a note had only one dimension no matter how it was
  written. Bullets did not fix that, because a bullet list is still a column.

  These are the same values the form already holds further down the page, so
  nothing here is new data or a second source of truth. What changes is that
  they are legible at a glance instead of buried in a sentence, which is the
  part that made an organized entry look organized.
*/

/*
  Pulls a risk-to-reward ratio back out of the prose.

  R:R is the fact traders quote first and the app has no field for it - Nova
  states it in the narrative instead ("targeting a 1:6 risk-to-reward"), so
  the only way to show it beside the other stats is to read it back out.

  Deliberately narrow: a bare ratio is not enough, because "the 15-minute"
  and a price like "1:2" in a time would both match. The ratio only counts
  when risk or reward is named within a few words of it.
*/
export function extractRiskReward(html: string): string | null {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  const pattern = /(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const around = text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40);
    if (/risk|reward|\bR\s*:\s*R\b|\bRR\b/i.test(around)) {
      return match[1].replace(/\s+/g, '');
    }
  }
  return null;
}

interface EntryStatRowProps {
  symbol: string;
  direction: string;
  positionSize: string;
  manualPnl: string;
  tradeDuration: string;
  /*
    Not a form field - it only ever exists inside Nova's prose, so it is
    lifted out by the caller rather than stored. Optional for that reason.
  */
  riskReward?: string | null;
}

interface Stat {
  label: string;
  value: string;
  className?: string;
}

export function EntryStatRow({
  symbol,
  direction,
  positionSize,
  manualPnl,
  tradeDuration,
  riskReward,
}: EntryStatRowProps) {
  const stats: Stat[] = [];

  if (symbol.trim()) {
    stats.push({ label: 'Symbol', value: symbol.trim().toUpperCase() });
  }

  if (direction.trim()) {
    stats.push({
      label: 'Direction',
      value: direction.trim().toUpperCase(),
      /*
        Long reads as the accent, short as plain grey - the same pairing the
        brand guide uses for gains and losses, so direction and P&L do not
        compete for meaning with two different colour languages.
      */
      className: direction.trim().toLowerCase() === 'long' ? 'text-brand-blue-light' : 'text-gray-300',
    });
  }

  if (riskReward && riskReward.trim()) {
    stats.push({ label: 'R:R', value: riskReward.trim() });
  }

  if (positionSize.trim()) {
    stats.push({ label: 'Size / Risk', value: positionSize.trim() });
  }

  /*
    Parsed rather than trusted: manual_pnl is a text input, so it can hold
    anything a person typed. An unparseable value still shows - it is what
    they meant - but only a real number gets the gain/loss colour.
  */
  if (manualPnl.trim()) {
    const parsed = Number(manualPnl.replace(/[$,\s]/g, ''));
    const isNumber = Number.isFinite(parsed);
    stats.push({
      label: 'P&L',
      /*
        Whole amounts stay whole, anything else gets both decimal places.
        Money with a single decimal - "-$420.5" - reads as a typo, while
        forcing ".00" onto every round number is noise on a page full of them.
      */
      value: isNumber
        ? `${parsed === 0 ? '' : parsed > 0 ? '+' : '-'}$${Math.abs(parsed).toLocaleString(undefined, {
            minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
            maximumFractionDigits: 2,
          })}`
        : manualPnl.trim(),
      className: isNumber ? valueColorClass(parsed) : undefined,
    });
  }

  if (tradeDuration.trim()) {
    stats.push({ label: 'Duration', value: tradeDuration.trim() });
  }

  // Nothing stated yet - an empty bar would just be a line of dead chrome.
  if (stats.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-white/10 bg-brand-elevated px-4 py-3">
      {/*
        Wraps rather than scrolls. A trade can carry six facts and a phone is
        narrow, so on a small screen these fall onto a second line instead of
        hiding the last of them off the right edge.
      */}
      <dl className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {stat.label}
            </dt>
            <dd
              className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${
                stat.className ?? 'text-gray-200'
              }`}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

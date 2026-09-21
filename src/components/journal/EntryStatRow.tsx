import { valueColorClass } from '../../utils/formatMetrics';

/*
  The facts of a trade, read across rather than down.

  Every other part of an entry stacks vertically - title, then tags, then a
  column of prose - so a note had only one dimension no matter how it was
  written. Bullets did not fix that, because a bullet list is still a column.

  These are the same values the form already holds, so nothing here is new
  data or a second source of truth. What changes is that they are legible at
  a glance instead of buried in a sentence, which is the part that made an
  organized entry look organized.

  Two renderers, one set of stats: EntryStatRow for the editor, where there
  is room for labels, and EntryStatStrip for the entry list, where there is
  not. Both read from buildEntryStats so a value can never format one way in
  the list and another way in the editor.
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

export interface EntryStatInput {
  symbol?: string | null;
  direction?: string | null;
  positionSize?: string | null;
  /*
    A string in the editor, where it is a text input a person types into, and
    a number once it has been saved to the database. Accepting both is what
    lets the list and the editor share this.
  */
  manualPnl?: string | number | null;
  tradeDuration?: string | null;
  riskReward?: string | null;
  /*
    Which account this entry belongs to. Sits with the figures rather than
    as a chip of its own because it answers the same kind of question they
    do - which account, which pair, which direction - and a trader running
    several accounts reads it as part of the same glance.
  */
  account?: string | null;
}

export interface EntryStat {
  key: string;
  label: string;
  value: string;
  className?: string;
}

const text = (v: string | number | null | undefined) => (v ?? '').toString().trim();

export function buildEntryStats(input: EntryStatInput): EntryStat[] {
  const stats: EntryStat[] = [];

  if (text(input.symbol)) {
    stats.push({ key: 'symbol', label: 'Symbol', value: text(input.symbol).toUpperCase() });
  }

  if (text(input.direction)) {
    stats.push({
      key: 'direction',
      label: 'Direction',
      value: text(input.direction).toUpperCase(),
      /*
        Long reads as the accent, short as plain grey - the same pairing the
        brand guide uses for gains and losses, so direction and P&L do not
        compete for meaning with two different colour languages.
      */
      className:
        text(input.direction).toLowerCase() === 'long' ? 'text-brand-blue-light' : 'text-gray-300',
    });
  }

  if (text(input.riskReward)) {
    stats.push({ key: 'rr', label: 'R:R', value: text(input.riskReward) });
  }

  if (text(input.positionSize)) {
    stats.push({ key: 'size', label: 'Size / Risk', value: text(input.positionSize) });
  }

  /*
    Parsed rather than trusted: in the editor manual_pnl is a text input, so
    it can hold anything a person typed. An unparseable value still shows -
    it is what they meant - but only a real number gets the gain/loss colour.
  */
  if (text(input.manualPnl)) {
    const parsed = Number(text(input.manualPnl).replace(/[$,\s]/g, ''));
    const isNumber = Number.isFinite(parsed);
    stats.push({
      key: 'pnl',
      label: 'P&L',
      /*
        Whole amounts stay whole, anything else gets both decimal places.
        Money with a single decimal - "-$420.5" - reads as a typo, while
        forcing ".00" onto every round number is noise on a page full of
        them. Breakeven takes no sign at all.
      */
      value: isNumber
        ? `${parsed === 0 ? '' : parsed > 0 ? '+' : '-'}$${Math.abs(parsed).toLocaleString(undefined, {
            minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
            maximumFractionDigits: 2,
          })}`
        : text(input.manualPnl),
      className: isNumber ? valueColorClass(parsed) : undefined,
    });
  }

  if (text(input.tradeDuration)) {
    stats.push({ key: 'duration', label: 'Duration', value: text(input.tradeDuration) });
  }

  /*
    Last, and never the reason a row renders. An entry always belongs to some
    account, so counting it would mean a card with nothing stated still drew
    a row saying only which account it was filed under.
  */
  if (text(input.account)) {
    stats.push({ key: 'account', label: 'Account', value: text(input.account), className: 'text-gray-400' });
  }

  return stats;
}

/*
  The labelled row, for the editor. Labels earn their space here because the
  column is wide and the values are being entered rather than scanned.
*/
export function EntryStatRow({ bare = false, ...props }: EntryStatInput & { bare?: boolean }) {
  const stats = buildEntryStats(props);

  // Nothing stated yet - an empty bar would just be a line of dead chrome.
  if (stats.length === 0) return null;

  /*
    `bare` drops the box. Inside the entry card the border and fill are
    already there, and nesting a second bordered panel inside the first
    reads as two objects when it is one.
  */
  return (
    <div
      className={bare ? 'mt-2' : 'mb-3 rounded-lg border border-white/10 bg-brand-elevated px-4 py-3'}
    >
      {/*
        Wraps rather than scrolls. A trade can carry six facts and a phone is
        narrow, so on a small screen these fall onto a second line instead of
        hiding the last of them off the right edge.
      */}
      <dl className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.key} className="min-w-0">
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

/*
  The unlabelled strip, for the entry list.

  Same values, same colours, no labels - the list sits in a column narrow
  enough that six label/value stacks would wrap into a mess, and in a list
  the reader is comparing entries rather than reading one, so the shape of
  "+$1,796.92" in blue carries the meaning that "P&L" would have.

  `omit` exists because the list already shows the symbol as its own badge in
  the corner; repeating it in the strip would be the duplication this whole
  change was meant to remove.
*/
export function EntryStatStrip({ omit = [], ...props }: EntryStatInput & { omit?: string[] }) {
  const stats = buildEntryStats(props).filter((s) => !omit.includes(s.key));

  if (stats.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {stats.map((stat, i) => (
        <span key={stat.key} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-gray-700">·</span>}
          <span className={`text-xs font-semibold tabular-nums ${stat.className ?? 'text-gray-300'}`}>
            {stat.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/*
  A year of squares that darken as somebody follows their own plan.

  Every rival journal's calendar is green and red money, and TradeX already
  has one of those on this same page. This grid earns its place by showing
  the thing none of them show: a dark square on a day you lost money, because
  you did what you said you would and the market did not care.

  That is also the only honest thing to grade daily. P&L on any one day is
  mostly noise. Whether you journalled it, followed your rules and met your
  own confluence minimum is entirely yours - see daily_process_scores() for
  how the three parts combine.

  Drawn as plain divs in a CSS grid rather than a chart library. It is 371
  rectangles; a charting dependency to draw rectangles is exactly the weight
  that makes an app feel slow for no gain.
*/

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from '../shared/Card';
import { getProcessScores, type ProcessDay } from '../../services/progressGrid';

/* 53 columns of 7 covers a year with room for the partial weeks at each end. */
const WEEKS = 53;

interface Props {
  userId: string;
  accountId: string | null;
}

/*
  Five steps, not a continuous gradient. A reader is asking "was that a good
  day or a bad one", which is a question with about five useful answers, and
  discrete steps are far easier to compare across a year than shades that
  blend into one another.

  Blue rather than the usual green: green means profit everywhere else in
  trading, and this grid is deliberately not about profit.
*/
function toneFor(score: number | undefined): string {
  if (score === undefined) return 'bg-white/[0.04]';
  if (score >= 90) return 'bg-brand-blue';
  if (score >= 75) return 'bg-brand-blue/70';
  if (score >= 55) return 'bg-brand-blue/45';
  return 'bg-brand-blue/25';
}

function startOfGrid(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (WEEKS * 7 - 1));
  /* Back up to Sunday so every column is a clean week. */
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export default function ProgressGrid({ userId, accountId }: Props) {
  const [days, setDays] = useState<ProcessDay[]>([]);
  const [loading, setLoading] = useState(true);

  const start = useMemo(startOfGrid, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getProcessScores(userId, start, new Date(), accountId).then((rows) => {
      if (!cancelled) {
        setDays(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId, accountId, start]);

  /*
    Keyed by date so the grid can look each cell up in constant time rather
    than scanning the list 371 times.
  */
  const byDay = useMemo(() => {
    const m = new Map<string, ProcessDay>();
    for (const d of days) m.set(d.day, d);
    return m;
  }, [days]);

  const cells = useMemo(() => {
    const out: { key: string; date: Date; day?: ProcessDay }[] = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    for (let i = 0; i < WEEKS * 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      if (date > today) break;
      const key = date.toISOString().slice(0, 10);
      out.push({ key, date, day: byDay.get(key) });
    }
    return out;
  }, [start, byDay]);

  const journalledDays = days.length;
  const avg = journalledDays
    ? Math.round(days.reduce((s, d) => s + d.score, 0) / journalledDays)
    : 0;

  /*
    The current run of consecutive journalled days, counted back from today.
    Yesterday is allowed to be the most recent one, because somebody looking
    at this in the morning has not journalled today yet and should not be
    told their streak is over.
  */
  const streak = useMemo(() => {
    if (!byDay.size) return 0;
    const probe = new Date();
    probe.setHours(0, 0, 0, 0);
    if (!byDay.has(probe.toISOString().slice(0, 10))) {
      probe.setDate(probe.getDate() - 1);
    }
    let n = 0;
    while (byDay.has(probe.toISOString().slice(0, 10))) {
      n++;
      probe.setDate(probe.getDate() - 1);
    }
    return n;
  }, [byDay]);

  return (
    <Card variant="default" className="bg-brand-elevated/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 mb-4">
        <div>
          <h2 className="text-sm sm:text-base font-medium">Your process</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            How closely you followed your own plan — not what the market did
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[11px] text-gray-500">Days journalled</p>
            <p className="text-lg font-semibold text-white tabular-nums">{journalledDays}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500">Average</p>
            <p className="text-lg font-semibold text-brand-blue-light tabular-nums">
              {journalledDays ? avg : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500">Streak</p>
            <p className="text-lg font-semibold text-white tabular-nums">{streak}</p>
          </div>
        </div>
      </div>

      {/*
        Scrolls sideways on a phone rather than shrinking the squares to
        nothing. A year does not fit in 375px and pretending otherwise gives
        you 3px cells that cannot be read or tapped.
      */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div
          className="grid grid-flow-col gap-[2px] w-max"
          style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
        >
          {cells.map(({ key, date, day }) => (
            <motion.div
              key={key}
              initial={false}
              className={`w-[10px] h-[10px] rounded-[2px] ${toneFor(day?.score)}`}
              title={
                day
                  ? `${date.toDateString()} — ${day.score}/100 from ${day.entries} ${day.entries === 1 ? 'entry' : 'entries'}`
                  : `${date.toDateString()} — nothing journalled`
              }
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-[11px] text-gray-500">
          {loading ? 'Loading…' : 'A dark square is a day you followed your plan, win or lose.'}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500">Less</span>
          {['bg-white/[0.04]', 'bg-brand-blue/25', 'bg-brand-blue/45', 'bg-brand-blue/70', 'bg-brand-blue'].map((c) => (
            <span key={c} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
          ))}
          <span className="text-[11px] text-gray-500">More</span>
        </div>
      </div>
    </Card>
  );
}

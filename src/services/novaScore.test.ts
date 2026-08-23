import { describe, it, expect } from 'vitest';
import { calculateNOVAScore, type TradeData } from './novaScore';

/*
  The Performance Metrics panel used to derive these from the summary
  numbers sitting next to them, which produced values that did not mean what
  their labels said:

    Best Trade     = max(win_rate, profit_factor), rendered as a percentage
    Success Streak = win_rate / 10, so one trade reported a 10-trade streak
    Monthly Growth = profit_factor x 12
    Avg Hold Time  = the hardcoded string "2.4h", identical for every user

  These lock the real computations in place. A trading journal that invents
  a trader's own numbers is worse than one that shows nothing.
*/

const t = (pnl: number, entry: string, exit: string): TradeData => ({
  profit_loss: pnl,
  entry_time: entry,
  exit_time: exit,
});

describe('NOVA score real performance metrics', () => {
  it('best and worst trade are actual P&L, not a percentage of something else', async () => {
    const r = await calculateNOVAScore([
      t(250, '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'),
      t(-80, '2026-08-02T10:00:00Z', '2026-08-02T11:00:00Z'),
      t(1200, '2026-08-03T10:00:00Z', '2026-08-03T11:00:00Z'),
    ]);
    expect(r.best_trade).toBe(1200);
    expect(r.worst_trade).toBe(-80);
  });

  it('counts the longest run of consecutive wins, in date order', async () => {
    // win, win, LOSS, win, win, win  -> longest run is 3
    const r = await calculateNOVAScore([
      t(10, '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'),
      t(10, '2026-08-02T10:00:00Z', '2026-08-02T11:00:00Z'),
      t(-5, '2026-08-03T10:00:00Z', '2026-08-03T11:00:00Z'),
      t(10, '2026-08-04T10:00:00Z', '2026-08-04T11:00:00Z'),
      t(10, '2026-08-05T10:00:00Z', '2026-08-05T11:00:00Z'),
      t(10, '2026-08-06T10:00:00Z', '2026-08-06T11:00:00Z'),
    ]);
    expect(r.longest_win_streak).toBe(3);
  });

  it('a single winning trade is a streak of one, not ten', async () => {
    const r = await calculateNOVAScore([t(4000, '2026-08-22T10:00:00Z', '2026-08-22T12:00:00Z')]);
    expect(r.total_trades).toBe(1);
    expect(r.longest_win_streak).toBe(1);
    expect(r.win_rate).toBe(100);
  });

  it('averages hold time from real timestamps', async () => {
    const r = await calculateNOVAScore([
      t(10, '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'), // 60 min
      t(10, '2026-08-02T10:00:00Z', '2026-08-02T13:00:00Z'), // 180 min
    ]);
    expect(r.avg_hold_minutes).toBe(120);
  });

  it('returns null hold time when no trade has a usable duration', async () => {
    // journal-logged trades collapse entry and exit to the same day, so
    // there is genuinely no duration to report
    const r = await calculateNOVAScore([
      t(1000, '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z'),
      t(4000, '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z'),
    ]);
    expect(r.avg_hold_minutes).toBeNull();
  });

  it('ignores zero-length trades when some real durations exist', async () => {
    const r = await calculateNOVAScore([
      t(10, '2026-08-01T10:00:00Z', '2026-08-01T10:00:00Z'), // no duration
      t(10, '2026-08-02T10:00:00Z', '2026-08-02T12:00:00Z'), // 120 min
    ]);
    expect(r.avg_hold_minutes).toBe(120);
  });

  it('reports zeroed metrics rather than NaN when there are no trades', async () => {
    const r = await calculateNOVAScore([]);
    expect(r.total_trades).toBe(0);
    expect(r.best_trade).toBe(0);
    expect(r.worst_trade).toBe(0);
    expect(r.longest_win_streak).toBe(0);
    expect(r.avg_hold_minutes).toBeNull();
  });

  it('still flags an all-winning record with the no-loss sentinel', async () => {
    // 10 is what the score code uses when there is no loss to divide by;
    // the UI turns this into "No losses yet" rather than printing "10.00"
    const r = await calculateNOVAScore([
      t(1000, '2026-08-15T10:00:00Z', '2026-08-15T11:00:00Z'),
      t(4000, '2026-08-22T10:00:00Z', '2026-08-22T11:00:00Z'),
    ]);
    expect(r.win_rate).toBe(100);
    expect(r.profit_factor).toBe(10);
    expect(r.best_trade).toBe(4000);
    expect(r.worst_trade).toBe(1000);
  });
});

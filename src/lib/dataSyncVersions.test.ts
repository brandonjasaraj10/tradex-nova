import { describe, it, expect } from 'vitest';
import {
  SYNC_TABLES,
  zeroVersions,
  applyChanges,
  computeTrigger,
  type SyncTable,
} from './dataSyncVersions';

const ALL = SYNC_TABLES;

describe('applyChanges', () => {
  it('bumps only the tables that changed', () => {
    const next = applyChanges(zeroVersions(), ['trades']);
    expect(next.trades).toBe(1);
    expect(next.trading_rules).toBe(0);
    expect(next.journal_entries).toBe(0);
  });

  /*
    The whole point of coalescing. A broker sync writes many trades and the
    provider collects them into a Set between flushes; if repeats counted
    separately, every listening page would reload once per row.
  */
  it('counts a burst of writes to one table as a single change', () => {
    const burst: SyncTable[] = Array.from({ length: 25 }, () => 'trades');
    expect(applyChanges(zeroVersions(), burst).trades).toBe(1);
  });

  it('bumps each distinct table once in a mixed burst', () => {
    const next = applyChanges(zeroVersions(), ['trades', 'journal_entries', 'trades']);
    expect(next.trades).toBe(1);
    expect(next.journal_entries).toBe(1);
  });

  it('does not mutate the previous versions', () => {
    const prev = zeroVersions();
    applyChanges(prev, ['trades']);
    expect(prev.trades).toBe(0);
  });
});

describe('computeTrigger', () => {
  it('does not move when an unwatched table changes', () => {
    const v0 = zeroVersions();
    const before = computeTrigger(v0, 0, ['trades']);
    const v1 = applyChanges(v0, ['trading_rules', 'user_profiles', 'broker_connections']);
    expect(computeTrigger(v1, 0, ['trades'])).toBe(before);
  });

  it('moves when a watched table changes', () => {
    const v0 = zeroVersions();
    const before = computeTrigger(v0, 0, ['trades', 'journal_entries']);
    const v1 = applyChanges(v0, ['journal_entries']);
    expect(computeTrigger(v1, 0, ['trades', 'journal_entries'])).toBeGreaterThan(before);
  });

  /*
    The regression this whole change exists to prevent: renaming a trading
    rule used to re-run Analytics, which regenerates AI insights through an
    edge function. Analytics watches trades and journal entries only.
  */
  it('a trading-rule edit leaves the Analytics trigger alone', () => {
    const analytics: SyncTable[] = ['trades', 'journal_entries'];
    const v0 = zeroVersions();
    const v1 = applyChanges(v0, ['trading_rules']);
    expect(computeTrigger(v1, 0, analytics)).toBe(computeTrigger(v0, 0, analytics));
  });

  it('a trade sync leaves the balance card alone', () => {
    const balance: SyncTable[] = ['broker_connections'];
    const v0 = zeroVersions();
    const v1 = applyChanges(v0, ['trades', 'journal_entries']);
    expect(computeTrigger(v1, 0, balance)).toBe(computeTrigger(v0, 0, balance));
  });

  it('forceRefresh moves every consumer, however narrowly scoped', () => {
    const v = zeroVersions();
    for (const table of ALL) {
      expect(computeTrigger(v, 1, [table])).toBeGreaterThan(computeTrigger(v, 0, [table]));
    }
  });

  it('an unscoped consumer sees every table, as it did before scoping existed', () => {
    const v0 = zeroVersions();
    for (const table of ALL) {
      const v1 = applyChanges(v0, [table]);
      expect(computeTrigger(v1, 0, ALL)).toBeGreaterThan(computeTrigger(v0, 0, ALL));
    }
  });

  /*
    Summing is only safe while versions increase monotonically: two tables
    moving in opposite directions could otherwise cancel out and hide a
    change. applyChanges only ever increments, and this pins that down.
  */
  it('never decreases as changes accumulate', () => {
    let v = zeroVersions();
    let last = computeTrigger(v, 0, ALL);
    for (const table of [...ALL, ...ALL, 'trades' as SyncTable]) {
      v = applyChanges(v, [table]);
      const now = computeTrigger(v, 0, ALL);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
  });
});

/*
  The version bookkeeping behind DataSyncProvider, kept separate so it can be
  tested without a React tree or a Supabase client.

  Both functions here are pure. The subtle part is not the arithmetic, it is
  the promise they make to callers: a component watching ['trades'] must not
  see its refresh trigger move when a trading rule changes, and a burst of
  writes to one table must count once. Those are exactly the properties the
  tests assert.
*/

export const SYNC_TABLES = [
  'trades',
  'journal_entries',
  'trading_confluences',
  'trading_rules',
  'broker_connections',
  'user_profiles',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export type Versions = Record<SyncTable, number>;

export function zeroVersions(): Versions {
  return SYNC_TABLES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {} as Versions);
}

/*
  Bump one version per distinct table in `changed`, whatever the order or the
  repetition. Callers collect changes in a Set between flushes, so twenty-five
  trade inserts arrive here as a single 'trades'.
*/
export function applyChanges(prev: Versions, changed: Iterable<SyncTable>): Versions {
  const next = { ...prev };
  for (const table of new Set(changed)) {
    next[table] = prev[table] + 1;
  }
  return next;
}

/*
  A single number a component can put in a dependency array.

  Summed rather than tupled because React compares dependencies by identity -
  a new array every render would defeat the point. Summing is sound here
  because versions only ever increase, so any change to a watched table
  strictly increases the total.
*/
export function computeTrigger(
  versions: Versions,
  manualVersion: number,
  tables: readonly SyncTable[],
): number {
  return tables.reduce((total, table) => total + versions[table], manualVersion);
}

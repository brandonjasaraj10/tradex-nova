/*
  The sync window, as arithmetic.

  Mirrors the logic in sync-all-accounts exactly. It is here because the bug
  it guards against is invisible in production: a lost trade produces
  "imported: 0", which is indistinguishable from a quiet day.
*/
const DAY = 24 * 60 * 60 * 1000;
const FULL_HISTORY_START = new Date("2000-01-01T00:00:00Z");

function plan({ lastSync, storedFloor, previousIds, live }) {
  const candidates = [storedFloor, live?.oldest ?? null].filter(d => d instanceof Date);
  const openFloor = candidates.length
    ? new Date(Math.min(...candidates.map(d => d.getTime()))) : null;

  const rollingStart = lastSync ? new Date(lastSync.getTime() - DAY) : FULL_HISTORY_START;

  const currentIds = live ? new Set(live.ids) : null;
  const somethingClosed = previousIds !== null && currentIds !== null &&
    previousIds.some(id => !currentIds.has(id));
  const needsDeepWindow = !live || previousIds === null || somethingClosed;

  const flooredStart = openFloor ? new Date(openFloor.getTime() - DAY) : null;
  const since = needsDeepWindow && flooredStart && flooredStart < rollingStart
    ? flooredStart : rollingStart;

  return { since, deep: needsDeepWindow };
}

const now = new Date("2026-09-17T06:00:00Z");
const results = [];
const check = (name, cond, detail = "") => results.push({ name, pass: !!cond, detail });
const covers = (since, opened) => opened >= since;

/* 1. The trade that started this: 35h hold, seen open, then closed. */
{
  const opened = new Date("2026-09-15T21:26:00Z");
  const p = plan({ lastSync: now, storedFloor: opened, previousIds: ["p1"], live: { oldest: null, ids: [] } });
  check("35h hold is found on the run it closes", p.deep && covers(p.since, opened), p.since.toISOString());
}

/* 2. A year-long position, still open: must NOT re-read a year every run. */
{
  const opened = new Date("2025-09-20T14:00:00Z");
  const p = plan({ lastSync: now, storedFloor: opened, previousIds: ["p1"], live: { oldest: opened, ids: ["p1"] } });
  check("a year-long open position uses the cheap window", !p.deep &&
    p.since.getTime() === now.getTime() - DAY, `${p.since.toISOString()} deep=${p.deep}`);
}

/* 3. That same year-long position closes. */
{
  const opened = new Date("2025-09-20T14:00:00Z");
  const p = plan({ lastSync: now, storedFloor: opened, previousIds: ["p1"], live: { oldest: null, ids: [] } });
  check("...and the deep window opens on the run it closes", p.deep && covers(p.since, opened), p.since.toISOString());
}

/* 4. Never recorded: one repair pass for a pre-existing long hold. */
{
  const opened = new Date("2025-09-20T14:00:00Z");
  const p = plan({ lastSync: now, storedFloor: null, previousIds: null, live: { oldest: opened, ids: ["p1"] } });
  check("an unrecorded account gets one deep repair pass", p.deep && covers(p.since, opened), p.since.toISOString());
}

/* 5. Positions call failed: cannot rule out a close. */
{
  const opened = new Date("2025-09-20T14:00:00Z");
  const p = plan({ lastSync: now, storedFloor: opened, previousIds: ["p1"], live: undefined });
  check("a failed positions call still reaches back", p.deep && covers(p.since, opened), p.since.toISOString());
}

/* 6. Steady state, nothing open, nothing closed. */
{
  const p = plan({ lastSync: now, storedFloor: null, previousIds: [], live: { oldest: null, ids: [] } });
  check("an idle account stays on the cheap window",
    !p.deep && p.since.getTime() === now.getTime() - DAY, p.since.toISOString());
}

/* 7. One of several positions closes; the rest stay open. */
{
  const older = new Date("2026-06-01T09:00:00Z");
  const p = plan({ lastSync: now, storedFloor: older, previousIds: ["p1","p2"], live: { oldest: older, ids: ["p2"] } });
  check("closing one of several positions triggers the deep window",
    p.deep && covers(p.since, older), p.since.toISOString());
}

/* 8. A new position opening must NOT trigger a deep read. */
{
  const p = plan({ lastSync: now, storedFloor: null, previousIds: ["p1"],
                   live: { oldest: new Date("2026-09-17T05:00:00Z"), ids: ["p1","p2"] } });
  check("opening a position does not trigger a deep read", !p.deep, `deep=${p.deep}`);
}

/* 9. First ever sync still takes the whole account. */
{
  const p = plan({ lastSync: null, storedFloor: null, previousIds: null, live: { oldest: null, ids: [] } });
  check("first sync still takes full history",
    p.since.getTime() === FULL_HISTORY_START.getTime(), p.since.toISOString());
}

/* 10. The floor must never NARROW the window below the rolling lookback. */
{
  const recent = new Date("2026-09-17T05:30:00Z");
  const p = plan({ lastSync: now, storedFloor: recent, previousIds: ["p1"], live: { oldest: null, ids: [] } });
  check("a recent floor never narrows the window",
    p.since.getTime() <= now.getTime() - DAY, p.since.toISOString());
}

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "\n        " + r.detail : ""}`);
}
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);

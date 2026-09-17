/* Mirrors the window logic in sync-all-accounts exactly. */
const DAY = 24 * 60 * 60 * 1000;
const FULL_HISTORY_START = new Date("2000-01-01T00:00:00Z");

function windowStart({ lastSync, storedFloor, liveOldest }) {
  const candidates = [storedFloor, liveOldest ?? null].filter(d => d instanceof Date);
  const openFloor = candidates.length
    ? new Date(Math.min(...candidates.map(d => d.getTime()))) : null;
  const rollingStart = lastSync ? new Date(lastSync.getTime() - DAY) : FULL_HISTORY_START;
  const flooredStart = openFloor ? new Date(openFloor.getTime() - DAY) : null;
  return flooredStart && flooredStart < rollingStart ? flooredStart : rollingStart;
}

const now = new Date("2026-09-17T06:00:00Z");
const t = [];
const ok = (name, cond, detail="") => t.push({ name, pass: cond, detail });

// 1. The bug that started this: 35-hour hold, no floor tracked (old behaviour)
{
  const opened = new Date("2026-09-15T21:26:00Z");
  const start = windowStart({ lastSync: now, storedFloor: null, liveOldest: null });
  ok("OLD behaviour loses a 35h hold", opened < start,
     `window starts ${start.toISOString()}, trade opened ${opened.toISOString()}`);
}

// 2. Same trade, but the position was seen open on an earlier run
{
  const opened = new Date("2026-09-15T21:26:00Z");
  const start = windowStart({ lastSync: now, storedFloor: opened, liveOldest: null });
  ok("floor from a PREVIOUS run catches it after it closes", opened >= start,
     `window starts ${start.toISOString()}`);
}

// 3. The two-month holder, position still open, floor never stored (backfill path)
{
  const opened = new Date("2026-07-15T10:00:00Z");
  const start = windowStart({ lastSync: now, storedFloor: null, liveOldest: opened });
  ok("live observation rescues a 2-month open position", opened >= start,
     `window starts ${start.toISOString()}`);
}

// 4. Two-month holder closes; floor was stored last run, nothing open now
{
  const opened = new Date("2026-07-15T10:00:00Z");
  const start = windowStart({ lastSync: now, storedFloor: opened, liveOldest: null });
  ok("2-month trade is findable on the run it closes", opened >= start,
     `window starts ${start.toISOString()}`);
}

// 5. Positions call failed (undefined) -> stored floor must still apply
{
  const opened = new Date("2026-07-15T10:00:00Z");
  const start = windowStart({ lastSync: now, storedFloor: opened, liveOldest: undefined });
  ok("a failed positions call does not release the floor", opened >= start,
     `window starts ${start.toISOString()}`);
}

// 6. Nothing open, nothing stored -> ordinary 24h lookback (no needless widening)
{
  const start = windowStart({ lastSync: now, storedFloor: null, liveOldest: null });
  ok("no open positions keeps the window tight",
     start.getTime() === now.getTime() - DAY, `window starts ${start.toISOString()}`);
}

// 7. First ever sync -> full history
{
  const start = windowStart({ lastSync: null, storedFloor: null, liveOldest: null });
  ok("first sync still takes full history",
     start.getTime() === FULL_HISTORY_START.getTime(), start.toISOString());
}

// 8. Floor must never make the window NARROWER than the rolling lookback
{
  const recent = new Date("2026-09-17T05:30:00Z");
  const start = windowStart({ lastSync: now, storedFloor: recent, liveOldest: null });
  ok("a recent floor never narrows the window",
     start.getTime() <= now.getTime() - DAY, `window starts ${start.toISOString()}`);
}

for (const r of t) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "\n        " + r.detail : ""}`);
console.log(`\n${t.filter(r=>r.pass).length}/${t.length} passed`);
process.exit(t.every(r=>r.pass) ? 0 : 1);

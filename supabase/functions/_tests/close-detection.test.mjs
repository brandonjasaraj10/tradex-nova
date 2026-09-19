/*
  When the open-positions panel should ask for a sync.

  Mirrors the comparison in src/components/trades/OpenPositions.tsx. The
  expensive mistake here is a FALSE fire - a sync on every poll, or on every
  account switch - so most of these assert that nothing happens.
*/
function makeDetector() {
  let seen = null;           // Set | null
  let syncing = false;
  const fired = [];
  return {
    reset() { seen = null; },
    poll(next) {             // next: {error?: boolean, ids: string[]}
      if (next.error) return;               // an errored read is not "all closed"
      const current = new Set(next.ids);
      const previous = seen;
      seen = current;
      if (!previous) return;                // nothing to compare against yet
      const closed = [...previous].some(id => !current.has(id));
      if (closed && !syncing) { fired.push([...previous].filter(id => !current.has(id))); }
    },
    setSyncing(v) { syncing = v; },
    fired,
  };
}

const t = [];
const ok = (name, cond, detail = '') => t.push({ name, pass: !!cond, detail });

/* 1. First poll must never fire - there is no baseline. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  ok('first poll does not fire', d.fired.length === 0);
}

/* 2. A position disappearing fires exactly once. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  d.poll({ ids: ['b'] });
  ok('a closed position fires', d.fired.length === 1 && d.fired[0][0] === 'a');
}

/* 3. Steady state does not fire. */
{
  const d = makeDetector();
  d.poll({ ids: ['a'] }); d.poll({ ids: ['a'] }); d.poll({ ids: ['a'] });
  ok('an unchanged position never fires', d.fired.length === 0);
}

/* 4. Opening a new position must not fire. */
{
  const d = makeDetector();
  d.poll({ ids: ['a'] });
  d.poll({ ids: ['a', 'b'] });
  ok('opening a position does not fire', d.fired.length === 0);
}

/* 5. An errored read must not look like everything closing. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  d.poll({ error: true, ids: [] });
  ok('an errored poll does not fire', d.fired.length === 0);
}

/* 6. ...and the baseline survives the error, so the next real close is caught. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  d.poll({ error: true, ids: [] });
  d.poll({ ids: ['b'] });
  ok('a close after an errored poll is still caught', d.fired.length === 1);
}

/* 7. Switching account resets the baseline - the new account's list is not
      a "close" of the old account's positions. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  d.reset();
  d.poll({ ids: [] });
  ok('switching account does not fire', d.fired.length === 0);
}

/* 8. The last position closing fires. */
{
  const d = makeDetector();
  d.poll({ ids: ['a'] });
  d.poll({ ids: [] });
  ok('closing the only position fires', d.fired.length === 1);
}

/* 9. A sync already in flight does not stack another. */
{
  const d = makeDetector();
  d.poll({ ids: ['a', 'b'] });
  d.setSyncing(true);
  d.poll({ ids: ['b'] });
  ok('no second sync while one is in flight', d.fired.length === 0);
}

for (const r of t) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
const p = t.filter(r => r.pass).length;
console.log(`\n${p}/${t.length} passed`);
process.exit(p === t.length ? 0 : 1);

/*
  The orphan sweep's decision rules.

  Imports the real module rather than restating it, because the failure this
  guards against is not a wrong number in a report - it is deleting a paying
  customer's live connection, which they can only undo by re-entering an
  investor password we deliberately never store.

  Run with:  deno test supabase/functions/_tests/orphan-decision.test.ts
*/

import { decideReleases } from "../_shared/orphanDecision.ts";

const NOW = new Date("2026-09-17T12:00:00Z");
const HOURS = 60 * 60 * 1000;
const ago = (h: number) => new Date(NOW.getTime() - h * HOURS);

const base = { now: NOW, quarantineHours: 1, maxPerRun: 5 };
const acct = (id: string) => ({ id, name: `TradeX ${id}` });

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: boolean, detail = "") =>
  results.push({ name, pass: cond, detail });

/* 1. The whole point: an account nobody points at, seen long enough ago. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("orphan-1"), acct("live-1")],
    referenced: new Set(["live-1"]),
    recorded: [{ id: "orphan-1", firstSeenAt: ago(3) }],
  });
  check(
    "a long-unreferenced account comes due",
    !d.abort && d.due.length === 1 && d.due[0] === "orphan-1",
    !d.abort ? d.due.join(",") : "aborted",
  );
}

/* 2. The race this whole design exists for: an account created seconds ago,
      whose id we have not saved yet. It must be recorded and NOT released. */
{
  const first = decideReleases({
    ...base,
    listed: [acct("brand-new"), acct("live-1")],
    referenced: new Set(["live-1"]),
    recorded: [],
  });
  check(
    "a brand-new account is quarantined, never released on sight",
    !first.abort && first.due.length === 0 &&
      first.quarantine.map((a) => a.id).join(",") === "brand-new",
    !first.abort ? `due=${first.due.length}` : "aborted",
  );
}

/* 3. Same account, one sweep later, now saved against a connection. The
      stale candidate row must be dropped, not acted on. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("brand-new"), acct("live-1")],
    referenced: new Set(["live-1", "brand-new"]),
    recorded: [{ id: "brand-new", firstSeenAt: ago(0.01) }],
  });
  check(
    "an account referenced since the last sweep is cleared, not released",
    !d.abort && d.due.length === 0 && d.stale.join(",") === "brand-new",
    !d.abort ? `stale=${d.stale.join(",")}` : "aborted",
  );
}

/* 4. Recorded, still orphaned, but inside the quarantine window. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("recent-orphan")],
    referenced: new Set(["live-1"]),
    recorded: [{ id: "recent-orphan", firstSeenAt: ago(0.5) }],
  });
  check(
    "an orphan inside the quarantine window waits",
    !d.abort && d.due.length === 0,
    !d.abort ? `due=${d.due.length}` : "aborted",
  );
}

/* 5. Exactly at the cutoff counts as due - the boundary is inclusive. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("edge")],
    referenced: new Set(["live-1"]),
    recorded: [{ id: "edge", firstSeenAt: ago(1) }],
  });
  check("the cutoff itself counts as due", !d.abort && d.due.length === 1);
}

/* 6. Refusal: MetaApi has accounts, we reference none. The broken-query
      case, where acting would wipe out every customer at once. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("a"), acct("b"), acct("c")],
    referenced: new Set<string>(),
    recorded: [{ id: "a", firstSeenAt: ago(99) }],
  });
  check(
    "an empty reference set aborts the whole run",
    d.abort && d.reason === "no-reference-set",
    d.abort ? d.reason : "did not abort",
  );
}

/* 7. Both empty is not an error - it is a product with nothing connected. */
{
  const d = decideReleases({
    ...base,
    listed: [],
    referenced: new Set<string>(),
    recorded: [],
  });
  check("no accounts anywhere is a quiet no-op", !d.abort && d.due.length === 0);
}

/* 8. Refusal: a crowd comes due at once. Releasing none is recoverable;
      releasing six is not. */
{
  const ids = ["o1", "o2", "o3", "o4", "o5", "o6"];
  const d = decideReleases({
    ...base,
    listed: [...ids.map(acct), acct("live-1")],
    referenced: new Set(["live-1"]),
    recorded: ids.map((id) => ({ id, firstSeenAt: ago(5) })),
  });
  check(
    "six due at once aborts rather than bulk-deleting",
    d.abort && d.reason === "too-many-due" && d.due.length === 6,
    d.abort ? `${d.due.length} due` : "did not abort",
  );
}

/* 9. The cap is a limit, not an off-by-one: exactly five proceeds. */
{
  const ids = ["o1", "o2", "o3", "o4", "o5"];
  const d = decideReleases({
    ...base,
    listed: [...ids.map(acct), acct("live-1")],
    referenced: new Set(["live-1"]),
    recorded: ids.map((id) => ({ id, firstSeenAt: ago(5) })),
  });
  check("exactly the cap is allowed through", !d.abort && d.due.length === 5);
}

/* 10. A recorded candidate MetaApi no longer lists at all - already gone.
       It must be cleared, and must never be counted as due. */
{
  const d = decideReleases({
    ...base,
    listed: [acct("live-1")],
    referenced: new Set(["live-1"]),
    recorded: [{ id: "already-deleted", firstSeenAt: ago(9) }],
  });
  check(
    "a candidate MetaApi no longer lists is cleared, not released",
    !d.abort && d.due.length === 0 && d.stale.join(",") === "already-deleted",
    !d.abort ? `due=${d.due.length} stale=${d.stale.join(",")}` : "aborted",
  );
}

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n        ${r.detail}` : ""}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
if (passed !== results.length) {
  throw new Error(`${results.length - passed} failing`);
}

/*
  Release MetaApi accounts that nothing in TradeX points at any more.

  Every provisioned account bills about $8.64 a month whether or not anyone
  uses it, and MetaApi has no idea when a user leaves us. The disconnect and
  delete-account paths now hand accounts back properly, but "we remembered
  everywhere" is not something to bet a recurring bill on - this is the
  backstop that catches whatever those paths miss, including anything they
  already missed before they were fixed.

  How it decides, and why it is so cautious:

  Every account under our MetaApi user was created by TradeX for a specific
  broker_connections row. So an account MetaApi lists that no row points at
  is, by definition, ours and unwanted. The danger is the connect flow -
  MetaApi creates the account, and a moment later we save its id. A sweep
  landing inside that window would see a real customer's brand-new account
  as an orphan.

  So nothing is released on first sight. A candidate is written down, and a
  later run releases it only if it is still unreferenced and was first seen
  more than QUARANTINE_HOURS ago. That uses our own clock rather than a
  createdAt from MetaApi, which the provisioning API makes no promise about
  returning.

  Three more refusals, because the cost of being wrong here is deleting a
  paying customer's live connection:

  - If the database read fails, stop. An empty reference set would make
    every account on the platform look like an orphan.
  - If MetaApi lists accounts but our reference set is empty, stop. That is
    either a broken query or a genuinely empty product, and in both cases
    doing nothing is right.
  - If more than MAX_RELEASES_PER_RUN accounts come due at once, release
    none of them and report it. A sweep is meant to catch stragglers; a
    crowd means something else is wrong.

  Dry by default. It reports what it would do and changes nothing at
  MetaApi unless the caller passes {"apply": true}.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { releaseMetaApiAccount } from "../_shared/metaApiAccount.ts";
import { decideReleases } from "../_shared/orphanDecision.ts";

const PROVISIONING_URL =
  // Global endpoint, not regional - see the note in mt-servers/index.ts.
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

/*
  Long enough that no connect flow could still be in flight. The connect
  function itself gives up well inside a minute; an hour is generous, and
  the cost of the extra wait is one sweep interval of billing on an account
  that is already dead.
*/
const QUARANTINE_HOURS = 1;

/*
  A straggler at a time is the expected shape. If a run ever finds a pile,
  the right response is a human looking at it, not a bulk delete.
*/
const MAX_RELEASES_PER_RUN = 5;

interface MetaApiAccount {
  _id?: string;
  id?: string;
  name?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  /* Same secret and header the other scheduled jobs already use. */
  const secret = Deno.env.get("CRON_SECRET");
  const token = Deno.env.get("METAAPI_TOKEN");

  if (!secret || !token) {
    return json({ error: "Not configured" }, 503);
  }
  if (req.headers.get("X-Cron-Secret") !== secret) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const apply = body?.apply === true;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  /* What MetaApi thinks we have. */
  const listed = await fetch(`${PROVISIONING_URL}/users/current/accounts`, {
    headers: { "auth-token": token },
  }).catch(() => null);

  if (!listed || !listed.ok) {
    return json({
      error: `Couldn't list accounts at MetaApi${listed ? ` (${listed.status})` : ""}.`,
    }, 502);
  }

  const accounts = await listed.json().catch(() => null) as MetaApiAccount[] | null;
  if (!Array.isArray(accounts)) {
    return json({ error: "MetaApi returned something that isn't a list of accounts." }, 502);
  }

  /* What we still point at. */
  const { data: rows, error: readError } = await admin
    .from("broker_connections")
    .select("metaapi_account_id")
    .not("metaapi_account_id", "is", null);

  if (readError) {
    /* Refusal 1: without the reference set, everything looks orphaned. */
    console.error("Reconcile aborted - could not read broker_connections:", readError);
    return json({ error: "Couldn't read our own connections. Nothing was touched." }, 500);
  }

  const referenced = new Set(
    (rows ?? []).map((r) => String(r.metaapi_account_id)),
  );

  /*
    Every recorded candidate, including ones a previous run already asked
    MetaApi to delete.

    This used to skip anything with a released_at, which treated "the DELETE
    returned OK" as "the account is gone". Those are not the same thing, and
    the first real release proved it: MetaApi accepted the delete and went on
    listing the account a minute and a half later. Skipping it meant we would
    never ask again - a bill that looks handled and is not.

    The only evidence that counts is MetaApi no longer listing it. So a still
    listed orphan is retried however many times we have asked before, and
    released_at is a record of the last attempt rather than a reason to stop.
    Once it really does disappear from the listing it stops being quarantined,
    falls out as stale, and the row goes.
  */
  const { data: recorded } = await admin
    .from("metaapi_orphan_candidates")
    .select("metaapi_account_id, first_seen_at");

  const decision = decideReleases({
    listed: accounts.map((a) => ({
      id: String(a._id ?? a.id ?? ""),
      name: a.name ?? null,
    })).filter((a) => a.id),
    referenced,
    recorded: (recorded ?? []).map((r) => ({
      id: String(r.metaapi_account_id),
      firstSeenAt: new Date(r.first_seen_at as string),
    })),
    now: new Date(),
    quarantineHours: QUARANTINE_HOURS,
    maxPerRun: MAX_RELEASES_PER_RUN,
  });

  if (decision.abort) {
    console.error("Reconcile aborted -", decision.reason, decision.detail);
    return json({
      error: `${decision.detail} Nothing was touched.`,
      reason: decision.reason,
      listed: accounts.length,
      referenced: referenced.size,
      due: decision.due,
    }, 409);
  }

  /*
    Write down what is orphaned now. Recording happens even on a dry run:
    the quarantine clock has to start somewhere, and a dry run that did not
    record would never let anything become due.
  */
  const seenAt = new Date().toISOString();
  for (const orphan of decision.quarantine) {
    await admin
      .from("metaapi_orphan_candidates")
      .upsert(
        {
          metaapi_account_id: orphan.id,
          account_name: orphan.name,
          last_seen_at: seenAt,
        },
        { onConflict: "metaapi_account_id", ignoreDuplicates: false },
      );
  }

  /* Anything referenced again is no longer a candidate. */
  for (const id of decision.stale) {
    await admin
      .from("metaapi_orphan_candidates")
      .delete()
      .eq("metaapi_account_id", id);
  }

  const due = decision.due;

  if (!apply) {
    return json({
      dryRun: true,
      listed: accounts.length,
      referenced: referenced.size,
      quarantined: decision.quarantine.map((o) => o.id),
      wouldRelease: due,
    });
  }

  const released: string[] = [];
  const failed: { id: string; detail?: string }[] = [];

  for (const id of due) {
    const result = await releaseMetaApiAccount(id, token);
    if (result.released) {
      released.push(id);
      await admin
        .from("metaapi_orphan_candidates")
        .update({ released_at: new Date().toISOString(), release_error: null })
        .eq("metaapi_account_id", id);
    } else {
      failed.push({ id, detail: result.detail });
      await admin
        .from("metaapi_orphan_candidates")
        .update({ release_error: result.detail ?? "unknown" })
        .eq("metaapi_account_id", id);
    }
  }

  return json({
    listed: accounts.length,
    referenced: referenced.size,
    quarantined: decision.quarantine.map((o) => o.id),
    released,
    failed,
  });
});

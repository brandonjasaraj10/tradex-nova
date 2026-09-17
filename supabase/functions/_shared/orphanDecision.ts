/*
  Deciding which MetaApi accounts to let go of.

  Separated from the sweep itself so it can be tested for real rather than
  by a copy of it in a test file. Everything here is arithmetic on values -
  no network, no database - and it is where all the refusals live, because
  the refusals are the part that matters. Releasing an account is not
  reversible from our side: the customer has to reconnect with a password
  we deliberately never store.

  Reads as: here is what MetaApi lists, here is what we still point at,
  here is what previous sweeps wrote down. What should happen?
*/

export interface ListedAccount {
  id: string;
  name: string | null;
}

export interface RecordedCandidate {
  id: string;
  firstSeenAt: Date;
}

export type OrphanDecision =
  | {
    abort: true;
    reason: "no-reference-set" | "too-many-due";
    detail: string;
    /* Present for too-many-due, so the report can name them. */
    due: string[];
  }
  | {
    abort: false;
    /* Orphaned right now - written down, not released. */
    quarantine: ListedAccount[];
    /* Recorded previously, still orphaned, and old enough to act on. */
    due: string[];
    /* Recorded previously but referenced again - drop the stale row. */
    stale: string[];
  };

export function decideReleases(params: {
  listed: ListedAccount[];
  referenced: Set<string>;
  recorded: RecordedCandidate[];
  now: Date;
  quarantineHours: number;
  maxPerRun: number;
}): OrphanDecision {
  const { listed, referenced, recorded, now, quarantineHours, maxPerRun } = params;

  /*
    Refusal 1: MetaApi has accounts and we point at none of them.

    Either the query that builds the reference set is broken or the product
    genuinely has no synced accounts. In the first case this would delete
    every customer's connection; in the second there is nothing to gain by
    acting. Both say stop.
  */
  if (listed.length > 0 && referenced.size === 0) {
    return {
      abort: true,
      reason: "no-reference-set",
      detail:
        `MetaApi lists ${listed.length} account${listed.length === 1 ? "" : "s"} and we reference none, so every one of them looks orphaned.`,
      due: [],
    };
  }

  const quarantine = listed.filter((a) => a.id && !referenced.has(a.id));
  const stillOrphaned = new Set(quarantine.map((a) => a.id));

  const stale = recorded
    .filter((r) => !stillOrphaned.has(r.id))
    .map((r) => r.id);

  /*
    The quarantine window uses our own clock and our own record of when we
    first saw the account unreferenced - never a timestamp from MetaApi,
    which the provisioning API makes no promise about returning. It exists
    to survive the connect flow's gap between "MetaApi created it" and "we
    saved its id"; an account seen orphaned across that whole window was
    not mid-connection.
  */
  const cutoff = now.getTime() - quarantineHours * 60 * 60 * 1000;
  const due = recorded
    .filter((r) => stillOrphaned.has(r.id) && r.firstSeenAt.getTime() <= cutoff)
    .map((r) => r.id);

  /*
    Refusal 2: a pile came due at once.

    This job exists to catch the occasional straggler. A crowd means either
    a bug here or something that deserves a person looking at it, and in
    both cases releasing none is the recoverable choice - the accounts stay
    in the table and the next run will report them again.
  */
  if (due.length > maxPerRun) {
    return {
      abort: true,
      reason: "too-many-due",
      detail:
        `${due.length} accounts came due at once, which is more than this job will release unattended.`,
      due,
    };
  }

  return { abort: false, quarantine, due, stale };
}

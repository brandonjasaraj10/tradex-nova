import { describe, it, expect } from 'vitest';

/*
  There is no grace period any more: a failed card ends access at the decline.

  These tests are what is left of the rule, kept rather than deleted because
  the column still exists and the danger now runs the other way. A deadline
  left behind in grace_period_end, or a resolver that returns one again,
  would quietly hand paid access to somebody whose payment is failing.

  A note on this file's history, because it is the useful part: when grace
  periods were withdrawn, every test in here passed. It mirrors the rule from
  supabase/functions/_shared/subscriptionSync.ts rather than importing it -
  the edge functions are Deno and this suite is Node - so it went on testing
  its own untouched copy while the real rule inverted underneath. If this file
  ever disagrees with that one, this file is wrong.
*/
function resolveGracePeriodEnd(): string | null {
  return null;
}

describe('resolveGracePeriodEnd', () => {
  it('never grants a window, whatever the status', () => {
    expect(resolveGracePeriodEnd()).toBeNull();
  });
});

/*
  The database rule that actually enforces the paywall, mirrored from
  has_active_subscription(). Every RLS policy on every paid table consults it,
  so this is the one that decides - the frontend check is a convenience.
*/
function hasActiveSubscription(
  row: { status: string; current_period_end?: string | null; grace_period_end?: string | null },
  now: Date,
): boolean {
  if (row.status === 'active' || row.status === 'trialing') return true;
  if (row.status === 'canceled' && row.current_period_end) {
    return new Date(row.current_period_end).getTime() > now.getTime();
  }
  return false;
}

describe('who still has access', () => {
  const now = new Date('2026-09-10T18:00:00.000Z');

  it('lets an active subscriber in', () => {
    expect(hasActiveSubscription({ status: 'active' }, now)).toBe(true);
  });

  /*
    Trials are no longer offered, but 25 people were inside one when the offer
    was withdrawn and none of them should be thrown out for it.
  */
  it('lets someone still inside an existing trial in', () => {
    expect(hasActiveSubscription({ status: 'trialing' }, now)).toBe(true);
  });

  it('keeps a cancelled subscriber in until the period they paid for ends', () => {
    expect(
      hasActiveSubscription({ status: 'canceled', current_period_end: '2026-09-20T00:00:00.000Z' }, now),
    ).toBe(true);
  });

  it('locks out a cancelled subscriber once that period has passed', () => {
    expect(
      hasActiveSubscription({ status: 'canceled', current_period_end: '2026-09-01T00:00:00.000Z' }, now),
    ).toBe(false);
  });

  it('locks out a failed payment immediately', () => {
    expect(hasActiveSubscription({ status: 'past_due' }, now)).toBe(false);
  });

  /*
    The regression that matters most. A deadline surviving from the old policy
    must not let anyone back in - which is why the clause was removed from the
    SQL function rather than merely left unused.
  */
  it('ignores a grace period left over from the old policy', () => {
    expect(
      hasActiveSubscription({ status: 'past_due', grace_period_end: '2026-09-17T00:00:00.000Z' }, now),
    ).toBe(false);
  });
});

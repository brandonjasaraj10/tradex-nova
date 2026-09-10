import { describe, it, expect } from 'vitest';

/*
  The grace-period rule from supabase/functions/_shared/subscriptionSync.ts.

  Mirrored here rather than imported: the edge functions are Deno and this
  suite is Node, so they cannot share a module. The logic is small and the
  cases below are the ones that actually cost a subscriber their access, so
  the duplication is worth catching a regression in. If the rule changes in
  one place it must change in both.

  It caught nothing when grace periods were withdrawn, because the mirror
  went on testing its own copy and passed while the real rule had inverted -
  which is exactly the failure mode a mirror invites. Worth remembering the
  next time this file disagrees with the function it claims to describe.
*/
function resolveGracePeriodEnd(
  status: string,
  existing: { status: string; grace_period_end: string | null } | null,
): string | null {
  if (status !== 'past_due') return null;
  if (existing?.status === 'past_due' && existing.grace_period_end) {
    return existing.grace_period_end;
  }
  return null;
}

const OPEN_WINDOW = '2026-09-17T00:00:00.000Z';

describe('resolveGracePeriodEnd', () => {
  /*
    The change that matters. A failed card used to buy seven days; it now
    stops access immediately, and the subscriber restores it by fixing the
    card rather than by waiting.
  */
  it('grants no window when a payment first fails', () => {
    expect(resolveGracePeriodEnd('past_due', null)).toBeNull();
  });

  it('grants no window when a subscription lapses with no row yet', () => {
    expect(resolveGracePeriodEnd('past_due', { status: 'active', grace_period_end: null }))
      .toBeNull();
  });

  /*
    The exception, and the reason this function is not simply () => null.
    Accounts that were already inside a grace period when the policy changed
    had been emailed the date it ends. Cutting them off early would make that
    email untrue.
  */
  it('honours a window that was already open', () => {
    expect(
      resolveGracePeriodEnd('past_due', { status: 'past_due', grace_period_end: OPEN_WINDOW })
    ).toBe(OPEN_WINDOW);
  });

  it('does not extend an open window on a later retry', () => {
    const preserved = resolveGracePeriodEnd(
      'past_due',
      { status: 'past_due', grace_period_end: OPEN_WINDOW }
    );
    expect(preserved).toBe(OPEN_WINDOW);
  });

  it.each(['active', 'trialing', 'canceled', 'incomplete', 'unpaid'])(
    'clears the window when status becomes %s',
    (status) => {
      const wasPastDue = { status: 'past_due', grace_period_end: OPEN_WINDOW };
      expect(resolveGracePeriodEnd(status, wasPastDue)).toBeNull();
    }
  );
});

/*
  Which of the two things the payment-failure email says, mirrored from
  buildPaymentFailedHtml for the same Deno/Node reason as above.
*/
function noticeIsStillOpen(gracePeriodEnd: string | null, now: Date): boolean {
  return gracePeriodEnd ? new Date(gracePeriodEnd).getTime() > now.getTime() : false;
}

describe('what the payment failure email tells the subscriber', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');

  it('says access is paused when there is no window', () => {
    expect(noticeIsStillOpen(null, now)).toBe(false);
  });

  /*
    The seven accounts carried over from the old policy. They can still get
    in, so telling them access is paused would send them to support over
    nothing.
  */
  it('says days remain while a carried-over window is still open', () => {
    expect(noticeIsStillOpen(OPEN_WINDOW, now)).toBe(true);
  });

  it('says access is paused once a carried-over window has passed', () => {
    expect(noticeIsStillOpen('2026-09-09T00:00:00.000Z', now)).toBe(false);
  });
});

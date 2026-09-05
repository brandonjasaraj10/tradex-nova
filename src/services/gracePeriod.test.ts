import { describe, it, expect } from 'vitest';

/*
  The grace-period rule from supabase/functions/_shared/subscriptionSync.ts.

  Mirrored here rather than imported: the edge functions are Deno and this
  suite is Node, so they cannot share a module. The logic is small and the
  cases below are the ones that actually cost a subscriber their access, so
  the duplication is worth catching a regression in. If the rule changes in
  one place it must change in both.
*/
const GRACE_PERIOD_DAYS = 7;

function resolveGracePeriodEnd(
  status: string,
  existing: { status: string; grace_period_end: string | null } | null,
  now: Date = new Date()
): string | null {
  if (status !== 'past_due') return null;
  if (existing?.status === 'past_due' && existing.grace_period_end) {
    return existing.grace_period_end;
  }
  return new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

const NOW = new Date('2026-09-03T12:00:00.000Z');
const SEVEN_DAYS_ON = '2026-09-10T12:00:00.000Z';

describe('resolveGracePeriodEnd', () => {
  it('opens a 7-day window when a payment first fails', () => {
    expect(resolveGracePeriodEnd('past_due', { status: 'active', grace_period_end: null }, NOW))
      .toBe(SEVEN_DAYS_ON);
  });

  it('opens a window when there is no subscription row yet', () => {
    expect(resolveGracePeriodEnd('past_due', null, NOW)).toBe(SEVEN_DAYS_ON);
  });

  /*
    The one that matters. Stripe fires an event per retry, so recomputing the
    deadline on each would push it further out every time and the grace period
    would never expire - the subscriber would keep full access indefinitely on
    a card that never charges.
  */
  it('does not extend a window that is already open', () => {
    const alreadyOpen = { status: 'past_due', grace_period_end: '2026-09-08T00:00:00.000Z' };
    const later = new Date('2026-09-06T12:00:00.000Z');
    expect(resolveGracePeriodEnd('past_due', alreadyOpen, later))
      .toBe('2026-09-08T00:00:00.000Z');
  });

  it('opens a fresh window if past_due recurs with no deadline recorded', () => {
    expect(resolveGracePeriodEnd('past_due', { status: 'past_due', grace_period_end: null }, NOW))
      .toBe(SEVEN_DAYS_ON);
  });

  it.each(['active', 'trialing', 'canceled', 'incomplete', 'unpaid'])(
    'clears the window when status becomes %s',
    (status) => {
      const wasPastDue = { status: 'past_due', grace_period_end: '2026-09-08T00:00:00.000Z' };
      expect(resolveGracePeriodEnd(status, wasPastDue, NOW)).toBeNull();
    }
  );
});

/*
  The "days left" wording in the payment-failure email, mirrored from
  sendPaymentFailedEmail in supabase/functions/_shared/subscriptionSync.ts for
  the same Deno/Node reason as above. If the rule changes there, change it here.
*/
function daysLeftFromGraceEnd(gracePeriodEnd: string | null, now: Date): number {
  return gracePeriodEnd
    ? Math.max(1, Math.ceil((new Date(gracePeriodEnd).getTime() - now.getTime()) / 86400000))
    : 7;
}

describe('days left in the payment failure email', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('counts a full window as seven days', () => {
    expect(daysLeftFromGraceEnd('2026-09-11T12:00:00.000Z', now)).toBe(7);
  });

  it('rounds a part day up, so half a day left still reads as one day', () => {
    expect(daysLeftFromGraceEnd('2026-09-05T00:00:00.000Z', now)).toBe(1);
  });

  /*
    Never zero or negative. Telling somebody they have 0 days while they still
    have access reads as though it is already too late, and a negative number
    is nonsense in a subject line.
  */
  it('never drops below one day, even past the deadline', () => {
    expect(daysLeftFromGraceEnd('2026-09-04T11:00:00.000Z', now)).toBe(1);
    expect(daysLeftFromGraceEnd('2026-09-01T12:00:00.000Z', now)).toBe(1);
  });

  it('falls back to the full window when no deadline was recorded', () => {
    expect(daysLeftFromGraceEnd(null, now)).toBe(7);
  });
});

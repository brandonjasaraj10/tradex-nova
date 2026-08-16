import { describe, it, expect } from 'vitest';
import { evaluateSubscriptionAccess, type Subscription } from './subscriptionService';

function makeSubscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub_1',
    user_id: 'user_1',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_stripe_1',
    stripe_price_id: null,
    status: 'active',
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    grace_period_end: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const NOW = new Date('2026-06-15T12:00:00Z');

describe('evaluateSubscriptionAccess', () => {
  it('grants access for an active subscription', () => {
    const result = evaluateSubscriptionAccess(makeSubscription({ status: 'active' }), NOW);
    expect(result.hasAccess).toBe(true);
  });

  it('grants access during a trial', () => {
    const result = evaluateSubscriptionAccess(makeSubscription({ status: 'trialing' }), NOW);
    expect(result.hasAccess).toBe(true);
  });

  it('grants access to a canceled subscription still inside its paid period', () => {
    const result = evaluateSubscriptionAccess(
      makeSubscription({ status: 'canceled', current_period_end: '2026-06-20T00:00:00Z' }),
      NOW
    );
    expect(result.hasAccess).toBe(true);
    expect(result.reason).toBe('Access until end of billing period');
  });

  it('revokes access to a canceled subscription once its period has actually ended', () => {
    const result = evaluateSubscriptionAccess(
      makeSubscription({ status: 'canceled', current_period_end: '2026-06-10T00:00:00Z' }),
      NOW
    );
    expect(result.hasAccess).toBe(false);
  });

  it('grants access to a past_due subscription still inside its grace period', () => {
    const result = evaluateSubscriptionAccess(
      makeSubscription({ status: 'past_due', grace_period_end: '2026-06-20T00:00:00Z' }),
      NOW
    );
    expect(result.hasAccess).toBe(true);
    expect(result.reason).toContain('Grace period');
  });

  it('revokes access once the past_due grace period has expired', () => {
    const result = evaluateSubscriptionAccess(
      makeSubscription({ status: 'past_due', grace_period_end: '2026-06-10T00:00:00Z' }),
      NOW
    );
    expect(result.hasAccess).toBe(false);
  });

  it('revokes access for an unpaid subscription', () => {
    const result = evaluateSubscriptionAccess(makeSubscription({ status: 'unpaid' }), NOW);
    expect(result.hasAccess).toBe(false);
  });

  it('revokes access for incomplete subscriptions', () => {
    const result = evaluateSubscriptionAccess(makeSubscription({ status: 'incomplete' }), NOW);
    expect(result.hasAccess).toBe(false);
  });

  it('revokes access when a canceled subscription has no period end at all', () => {
    const result = evaluateSubscriptionAccess(
      makeSubscription({ status: 'canceled', current_period_end: null }),
      NOW
    );
    expect(result.hasAccess).toBe(false);
  });
});

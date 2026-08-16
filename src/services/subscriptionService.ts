import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = [
  'brandon.jasaraj10@gmail.com',
  'imbrandonski@gmail.com',
];

const ADMIN_USER_IDS = [
  '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63',
];

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionAccess {
  hasAccess: boolean;
  subscription: Subscription | null;
  reason?: string;
}

export async function getSubscription(): Promise<Subscription | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

export async function checkSubscriptionAccess(): Promise<SubscriptionAccess> {
  const { data: { user } } = await supabase.auth.getUser();

  if (
    (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) ||
    (user?.id && ADMIN_USER_IDS.includes(user.id))
  ) {
    return {
      hasAccess: true,
      subscription: null,
      reason: 'Admin access'
    };
  }

  const subscription = await getSubscription();

  if (!subscription) {
    return {
      hasAccess: false,
      subscription: null,
      reason: 'No subscription found'
    };
  }

  return evaluateSubscriptionAccess(subscription, new Date());
}

// Pure decision logic, split out from checkSubscriptionAccess() so it's
// testable without mocking supabase.auth - mirrors has_active_subscription()
// on the database side (the actual RLS gate), so this is a behavioral
// cross-check on that logic, not just documentation of intent.
export function evaluateSubscriptionAccess(subscription: Subscription, now: Date): SubscriptionAccess {
  const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const gracePeriodEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end) : null;

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return {
      hasAccess: true,
      subscription
    };
  }

  if (subscription.status === 'canceled' && currentPeriodEnd && now < currentPeriodEnd) {
    return {
      hasAccess: true,
      subscription,
      reason: 'Access until end of billing period'
    };
  }

  if (subscription.status === 'past_due' && gracePeriodEnd && now < gracePeriodEnd) {
    return {
      hasAccess: true,
      subscription,
      reason: 'Grace period active - please update payment method'
    };
  }

  return {
    hasAccess: false,
    subscription,
    reason: getNoAccessReason(subscription, now, currentPeriodEnd, gracePeriodEnd)
  };
}

function getNoAccessReason(
  subscription: Subscription,
  now: Date,
  currentPeriodEnd: Date | null,
  gracePeriodEnd: Date | null
): string {
  if (subscription.status === 'past_due') {
    if (gracePeriodEnd && now >= gracePeriodEnd) {
      return 'Grace period expired - please update payment method';
    }
    return 'Payment failed - please update payment method';
  }

  if (subscription.status === 'canceled') {
    if (currentPeriodEnd && now >= currentPeriodEnd) {
      return 'Subscription ended - reactivate to continue';
    }
    return 'Subscription canceled';
  }

  if (subscription.status === 'unpaid') {
    return 'Payment required to access platform';
  }

  if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
    return 'Please complete payment setup';
  }

  return 'Subscription required';
}

export async function isSubscriptionActive(): Promise<boolean> {
  const access = await checkSubscriptionAccess();
  return access.hasAccess;
}

export async function getTrialDaysRemaining(): Promise<number | null> {
  const subscription = await getSubscription();

  if (!subscription || subscription.status !== 'trialing' || !subscription.current_period_end) {
    return null;
  }

  const trialEnd = new Date(subscription.current_period_end);
  const now = new Date();
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return daysRemaining > 0 ? daysRemaining : 0;
}

export async function isInTrial(): Promise<boolean> {
  const subscription = await getSubscription();
  return subscription?.status === 'trialing';
}

export async function cancelSubscription(): Promise<void> {
  const subscription = await getSubscription();

  if (!subscription?.stripe_subscription_id) {
    throw new Error('No active subscription found');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({
        subscriptionId: subscription.stripe_subscription_id,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel subscription');
  }
}

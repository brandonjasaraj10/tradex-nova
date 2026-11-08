import { FREE_PLAN_ENABLED } from './featureFlags';

/*
  Free plan helpers shared by the screens that hit a limit.

  The database is what enforces the limits (see the free_plan_* functions);
  these only turn its refusals into something a person can read.
*/

export const FREE_ENTRY_LIMIT = 5;
export const FREE_VOICE_LIMIT = 3;
export const FREE_SCREENSHOT_LIMIT = 2;

const MESSAGES: Record<string, string> = {
  free_plan_entry_limit:
    "That's your 5 free entries this week. Your writing is still here. They reset Sunday night, or start your free trial for unlimited.",
  free_plan_screenshot_limit:
    'Free entries hold 2 screenshots. Start your free trial to add more.',
  free_plan_account_limit:
    'The free plan has 1 account. Start your free trial to add more.',
};

/* The friendly message for a free plan refusal, or null if the error is something else. */
export function freePlanMessage(err: unknown): string | null {
  const text = err instanceof Error
    ? err.message
    : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (text.includes(code)) return message;
  }
  return null;
}

/*
  Whether this person already chose "Continue free" on the upgrade screen, so
  it is offered once rather than on every visit. Per browser, which is fine:
  seeing the offer again on a new device costs one tap.
*/
const continuedKey = (userId: string) => `tradex.freePlan.continued.${userId}`;

export function hasContinuedFree(userId: string): boolean {
  if (!FREE_PLAN_ENABLED) return false;
  try {
    return localStorage.getItem(continuedKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markContinuedFree(userId: string) {
  try {
    localStorage.setItem(continuedKey(userId), '1');
  } catch {
    /* storage unavailable: they'll see the offer once more next time */
  }
}

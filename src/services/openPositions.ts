/*
  Positions the trader is in right now.

  Read live every time rather than stored, because a position's value
  changes every tick and a cached one is a lie with a timestamp on it. The
  cost of that choice is that this needs the account to be running, which is
  why the "not running" case is a first-class answer here rather than an
  error.
*/

import { supabase } from '../lib/supabase';

export interface OpenPosition {
  position_id: string | null;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  volume: number | null;
  open_price: number | null;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_distance: number | null;
  reward_distance: number | null;
  unrealised_pnl: number | null;
  swap: number | null;
  commission: number | null;
  opened_at: string | null;
}

export interface OpenPositionsResult {
  positions: OpenPosition[];
  count: number;
  without_a_stop: number;
  total_unrealised: number;
  as_of: string | null;
  /* Set when the account is connected but not currently running. */
  accountNotRunning?: boolean;
  error?: string;
}

const EMPTY: OpenPositionsResult = {
  positions: [], count: 0, without_a_stop: 0, total_unrealised: 0, as_of: null,
};

export async function getOpenPositions(connectionId: string): Promise<OpenPositionsResult> {
  try {
    const { data, error } = await supabase.functions.invoke('metaapi-positions', {
      body: { connectionId },
    });

    if (error) {
      /*
        supabase-js hides the body on a non-2xx, and the body is where the
        difference between "your account is stopped" and "something broke"
        lives. Worth digging out: those need different words on screen.
      */
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          return {
            ...EMPTY,
            accountNotRunning: body?.accountNotRunning === true,
            error: typeof body?.error === 'string' ? body.error : 'Could not read open positions.',
          };
        } catch {
          /* fall through to the generic message */
        }
      }
      return { ...EMPTY, error: 'Could not read open positions.' };
    }

    return {
      positions: Array.isArray(data?.positions) ? data.positions : [],
      count: data?.count ?? 0,
      without_a_stop: data?.without_a_stop ?? 0,
      total_unrealised: data?.total_unrealised ?? 0,
      as_of: data?.as_of ?? null,
    };
  } catch {
    return { ...EMPTY, error: 'Could not read open positions.' };
  }
}

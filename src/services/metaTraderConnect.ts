/*
  Hand a MetaTrader account's credentials to our backend so it can be
  registered with MetaApi and synced from then on.

  The investor password passes through this function and is never stored
  anywhere on the client: not in state beyond the form, not in
  localStorage, not in a query string. The caller is expected to clear it
  from component state as soon as this resolves, whichever way it resolves.

  Errors are returned rather than thrown because every one of them is
  something the user needs to read and act on - a wrong server name, a
  rejected password - not an exception to swallow.
*/

import { supabase } from '../lib/supabase';

export interface ConnectResult {
  ok: boolean;
  /* Present when ok: MetaApi's id for the account. Not a secret. */
  accountId?: string;
  /*
    A connection can be accepted and still be coming up - MetaTrader
    accounts take a moment. false here with ok: true means "registered,
    still connecting", which is a normal, non-alarming state.
  */
  connected?: boolean;
  error?: string;
}

export async function connectMetaTraderAccount(params: {
  connectionId: string;
  login: string;
  server: string;
  password: string;
  platform: 'mt4' | 'mt5';
}): Promise<ConnectResult> {
  try {
    const { data, error } = await supabase.functions.invoke('metaapi-connect', {
      body: params,
    });

    /*
      supabase-js turns any non-2xx into `error` and hides the body, but
      the body is where our readable message lives ("Invalid account
      credentials"). Dig it out rather than showing "Edge Function
      returned a non-2xx status code" to a trader.
    */
    if (error) {
      let message = 'Could not connect that account.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (typeof body?.error === 'string') message = body.error;
        } catch {
          /* keep the generic message */
        }
      }
      return { ok: false, error: message };
    }

    if (data?.error) {
      return { ok: false, error: String(data.error) };
    }

    return {
      ok: true,
      accountId: data?.accountId,
      connected: Boolean(data?.connected),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not connect that account.',
    };
  }
}

export interface SyncResult {
  ok: boolean;
  imported?: number;
  error?: string;
}

/*
  Pull the latest closed trades for an already-connected account.

  Safe to call repeatedly - the backend upserts on the broker's own trade
  id, so pressing the button twice imports the same trades rather than
  duplicating them.
*/
export async function syncMetaTraderAccount(connectionId: string): Promise<SyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('metaapi-sync', {
      body: { connectionId },
    });

    if (error) {
      let message = 'Could not sync that account.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (typeof body?.error === 'string') message = body.error;
        } catch {
          /* keep the generic message */
        }
      }
      return { ok: false, error: message };
    }

    if (data?.error) return { ok: false, error: String(data.error) };
    return { ok: true, imported: Number(data?.imported ?? 0) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not sync that account.',
    };
  }
}

/*
  Suggestions for the "Server" field on the MetaTrader connect form.

  Suggestions only, never a constraint. Server names have to match the
  broker's string exactly, there are thousands of them, and MetaApi's own
  docs note that servers missing from their catalogue often still connect -
  so a user must always be able to type one we've never heard of.

  The search runs through our own edge function because the MetaApi token
  can't be exposed to the browser.
*/

import { supabase } from '../lib/supabase';

export interface MtServerSuggestion {
  server: string;
  broker: string;
}

export async function searchMtServers(
  platform: 'mt4' | 'mt5',
  query: string,
): Promise<MtServerSuggestion[]> {
  if (query.trim().length < 2) return [];

  try {
    const { data, error } = await supabase.functions.invoke('mt-servers', {
      body: { platform, query },
    });
    if (error) return [];
    return Array.isArray(data?.servers) ? data.servers : [];
  } catch {
    /*
      Silent on purpose. A failed lookup costs the user nothing - the field
      is still a text box - so an error toast here would be noise about a
      convenience that didn't load.
    */
    return [];
  }
}

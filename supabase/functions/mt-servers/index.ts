/*
  Search MetaApi's catalogue of known MetaTrader servers.

  This exists as a function rather than a direct call from the browser for
  one reason: the MetaApi token. It is a secret with full access to our
  MetaApi account, so it can only ever live server-side. The browser asks
  us, we ask MetaApi.

  Why a live search rather than a list we ship: server names have to match
  the broker's exactly ("FTMO-Server2", not "FTMO Server 2"), there are
  thousands of them, and they change. A hard-coded list would be wrong
  quietly - a stale suggestion looks authoritative and sends the user down
  a failing connection they can't diagnose.

  Returns suggestions only. The user can always type a server we've never
  heard of, because MetaApi's own docs say unlisted servers often still
  work.
*/

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    /*
      Signed-in users only. This costs us a call to a third party, so it
      isn't something an anonymous caller gets to run in a loop.
    */
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const platform = body?.platform === "mt4" ? "mt4" : "mt5";
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (query.length < 2) {
      return json({ servers: [] });
    }

    const token = Deno.env.get("METAAPI_TOKEN");
    if (!token) {
      /*
        Not an error the user should see as a failure - the field still
        works as free text. Say so plainly so the frontend can stay quiet
        instead of showing a scary message.
      */
      return json({ servers: [], unavailable: true });
    }

    const version = platform === "mt4" ? 4 : 5;
    const url =
      `https://mt-provisioning-api-v1.new-york.agiliumtrade.ai/known-mt-servers/${version}/search` +
      `?query=${encodeURIComponent(query)}`;

    const res = await fetch(url, { headers: { "auth-token": token } });
    if (!res.ok) {
      return json({ servers: [], unavailable: true });
    }

    /*
      MetaApi answers { "Broker Name": ["Server1", "Server2"], ... }.
      Flattened to a list, keeping the broker alongside each server so the
      dropdown can show "FTMO-Server2 - FTMO" and the user can tell two
      similarly-named servers apart.
    */
    const grouped = await res.json() as Record<string, string[]>;
    const servers: { server: string; broker: string }[] = [];
    for (const [broker, list] of Object.entries(grouped ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const server of list) {
        if (typeof server === "string") servers.push({ server, broker });
      }
    }

    return json({ servers });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

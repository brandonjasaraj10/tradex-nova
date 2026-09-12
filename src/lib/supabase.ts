import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

/*
  Who is logged in, without asking the server every time.

  `supabase.auth.getUser()` is not a local lookup - it makes a GET to
  /auth/v1/user on every single call. Measured from a wired connection it
  costs ~230ms per call, and it was being called 53 times across the app,
  six of them on a single Dashboard load. Worse than the raw count is where
  it sat: almost every data loader in the app opened with

      const { data: { user } } = await supabase.auth.getUser();
      ... then built its real query

  so the query the page actually needed did not start until a round trip
  that returned an id the app already had in memory had finished. That is a
  flat ~230ms added to every data load on every page - far more on a phone -
  and it is the single biggest reason the app felt sluggish everywhere
  rather than on one slow screen.

  The session is already in localStorage and already kept fresh by
  autoRefreshToken, so the id can be read locally. `getSession()` does
  exactly that: it reads storage and only touches the network when the
  token has actually expired.

  This is not a weakening of security. The client-side id is only used to
  build queries; it has never been what protects the data. Every request
  still carries the real JWT, and RLS on the server still decides what that
  JWT is allowed to see - an attacker editing this value client-side gets
  rejected by Postgres exactly as before.
*/
let cachedUser: User | null = null;
let hasCachedUser = false;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
  hasCachedUser = true;
});

export async function getCurrentUser(): Promise<User | null> {
  if (hasCachedUser) return cachedUser;
  const { data: { session } } = await supabase.auth.getSession();
  cachedUser = session?.user ?? null;
  hasCachedUser = true;
  return cachedUser;
}

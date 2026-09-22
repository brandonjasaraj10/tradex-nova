/*
  Close a publicly readable backup table.

  Supabase's linter flagged public.trades_orphan_backup_20260914 as
  rls_disabled_in_public: the table sits in the public schema, so PostgREST
  exposes it, and with row level security never enabled anyone holding the
  project URL and the anon key could read, edit or delete every row in it.
  The anon key ships in the frontend bundle, so that is effectively public.

  It holds 56 rows of real trade data across 3 users - 29 columns, the full
  shape of the trades table - taken as a backup on 2026-09-14 while sorting
  out orphaned trades.

  Enabling RLS with no policies is the right fix rather than an oversight:
  nothing reads this table. Checked before writing this - no view, no
  function, no code path references it - so there is no client that needs a
  policy. With RLS on and no policy, every request through the anon or
  authenticated role is denied, while the service role and SECURITY DEFINER
  functions are unaffected, which is exactly the access a backup should
  have.

  Deliberately NOT dropped. It is somebody's trade history and the reason it
  was taken has not been re-verified; deleting it is a separate decision,
  and it is now inaccessible either way. The same applies to any other
  dated backup left in public - the pattern is what to watch for, not this
  one table.
*/

alter table public.trades_orphan_backup_20260914 enable row level security;

/*
  Left on as well. Without it a table owner - which migrations run as - can
  still bypass the policies that are not there, so the lock is only as good
  as who is connecting.
*/
alter table public.trades_orphan_backup_20260914 force row level security;

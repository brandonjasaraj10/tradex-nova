/*
  Limit how many *different* trading accounts one subscriber connects in a
  month, separately from how many they hold at once.

  The concurrent cap alone does not bound cost. MetaApi charges $2.10 per
  unique account added per calendar month, so connect, disconnect, connect a
  different one is $2.10 every time, and two slots could be cycled without
  limit. The concurrent cap answers "how much are you running"; this answers
  "how much have you cost us".

  Counted per distinct account rather than per connection on purpose, because
  that is precisely what MetaApi bills: adding the same login on the same
  server again in the same month costs nothing extra. Disconnecting and
  reconnecting the same account is also ordinary troubleshooting, and should
  never burn an allowance.

  The login and server are not secrets - they are what the terminal shows.
  The investor password is not here and is not stored anywhere.
*/

CREATE TABLE IF NOT EXISTS public.synced_account_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- login@server, lowercased: the identity MetaApi charges per.
  account_key text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synced_account_activations_user_month_idx
  ON public.synced_account_activations (user_id, activated_at);

ALTER TABLE public.synced_account_activations ENABLE ROW LEVEL SECURITY;

/*
  Readable by the owner so the UI can say how many are left. No insert
  policy: only the connect function writes here, through the service role.
  A user who could write their own rows could not raise their allowance, but
  they could certainly confuse it.
*/
CREATE POLICY "Users can read their own activations"
  ON public.synced_account_activations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

/*
  How many different accounts may be connected in a calendar month.

  Deliberately more than the concurrent cap. A prop trader failing a
  challenge and starting a fresh account is the normal case, not abuse, and
  a limit that punished it would be worse than the cost it saved. Four bounds
  the exposure at about $8.40 a month per subscriber in the worst case, while
  leaving room to swap both accounts once.
*/
CREATE OR REPLACE FUNCTION public.synced_accounts_this_month()
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT count(DISTINCT account_key)::int
  FROM public.synced_account_activations
  WHERE user_id = auth.uid()
    AND activated_at >= date_trunc('month', now());
$function$;

CREATE OR REPLACE FUNCTION public.synced_account_month_limit()
RETURNS integer
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN auth.uid() = '5a1346b7-f0b8-4c9f-ab38-d51ac9882c63'::uuid
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY['brandon.jasaraj10@gmail.com', 'imbrandonski@gmail.com', 'rodriguezjuanjmrg@gmail.com'])
    THEN 20
    ELSE 4
  END;
$function$;

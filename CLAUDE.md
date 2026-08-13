# TradeX Nova

## Project

TradeX Nova — a trading journal SaaS. React/Vite frontend, Supabase backend,
Stripe for payments, Claude (Anthropic) powers the Nova AI chat feature —
switched from OpenAI on 2026-08-13, see the note under "Fix order" below.
Pre-launch: zero real users yet. The domain tradexnova.com is currently
lost/expired and needs to be re-purchased before there's a live public
site again.

Git was initialized in this project on 2026-08-12 specifically so this
cleanup work is reversible. `.env` is gitignored and confirmed never
committed — it holds real API keys/secrets and must stay out of git.

**Which Supabase project is real (found 2026-08-13):** the `.env` file
originally pointed at `cdyxszpwxqpcqfzbtmra`, a project live and working
but NOT visible in the user's own Supabase account (likely Bolt-managed,
inaccessible). The user's actual Supabase account has two projects: "Trade
X" (`irtlwmpcfzjrlrxicxbk`, ACTIVE_HEALTHY) and an unrelated inactive one
("VCT"). Decision made: standardize on **Trade X**
(`irtlwmpcfzjrlrxicxbk`) going forward — `.env`'s `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` now point there. `cdyxszpwxqpcqfzbtmra` is
untouched and still exists under Bolt; unpublishing it is a separate,
user-owned step in Bolt's own dashboard, not something done from here.

**Trade X's live schema has drifted from this repo's migration files** —
confirmed by testing, not just reading code. Two concrete examples found
so far: `user_broker_connections` is a view with different columns than
the code expects (broker-connect is currently broken there, but this
becomes moot once fix #8 deletes that code), and the real `subscriptions`
table has `plan_type`/`grace_period_end` instead of
`trial_start`/`trial_end`/`stripe_price_id`/`canceled_at` (already fixed
in `activate-subscription`, commit `117e37a`). **Lesson: before writing
code that touches a table on Trade X, check its actual live columns
first** (`supabase db query --linked "select column_name from
information_schema.columns where table_name='X'"`) rather than trusting
the migration files in this repo — they describe intent, not
necessarily reality on this specific database.

**Local tooling set up this session** (not permanent — lives in the
session's scratchpad, would need reinstalling in a fresh session): the
Supabase CLI (no Docker available, so `--linked`/`db query` are used
instead of the Docker-dependent commands) and Node.js, both installed as
standalone binaries since neither `brew` nor `npm`/`node` exist on this
machine by default. A Supabase Personal Access Token was provided by the
user and used to log in the CLI. `.claude/launch.json` runs the dev
server via a wrapper script that sets PATH before calling `npm run dev`,
since the spawned process doesn't inherit the session's PATH.

## Current work

Pre-launch security audit and cleanup. **Do not launch until the critical
findings below are fixed.** A full audit was done on 2026-08-12 (four
parallel reviews: edge functions, RLS/migrations, frontend, broker/proxy
code) with no prior findings doc — this list is the result.

## Fix order

Work through these one at a time. Do not batch.

1. **[DONE — commit `417d3d6`, 2026-08-12]** `log-journal-entry` — derive
   the user from the JWT, never from the request body. This was a
   cross-user write hole: anyone could pass an arbitrary `user_id` and the
   function would switch to the service-role key (bypassing all database
   protection) to write into that user's journal. Fixed: identity now
   always comes from verifying the caller's login token.
2. **[DONE — commit `fe46771`, 2026-08-12]** `metatrader-sync` `/sync`
   route — add the ownership check. Cross-user trade data read hole: any
   logged-in user could pass someone else's `connection_id` and pull
   their real trade data. Fixed: now checks the connection belongs to
   the caller before syncing, same as the `/diagnose` route already did.
3. **[DONE — commit `2efb95c`, corrected in `117e37a`, deployed to Trade
   X, 2026-08-13]** `activate-subscription` — require real Stripe
   verification. Anyone could grant themselves a free paid subscription
   by calling the function directly with no payment (there was even a
   public "Activate Subscription (Testing)" button on the Payment/
   Settings pages doing exactly this). Fixed: the function now looks
   the subscription up in Stripe itself and only writes what Stripe
   actually reports for that verified user — no more trusting a
   client-supplied duration. Also had to correct it once more (commit
   `117e37a`) after testing revealed the live `subscriptions` table on
   Trade X doesn't have the columns the first version assumed — see the
   schema-drift note above. Note: the "Activate Subscription (Testing)"
   button will now correctly show an error for anyone who hasn't
   actually paid through Stripe — that button's copy/visibility should
   get cleaned up as part of fix #4 or #9.

**Deployed to Trade X so far (2026-08-13):** fixes #1, #2, #3 (all three
edge functions), plus the waitlist RLS leak (fix #7, done early/out of
order since it was live and actively exposing 7 real emails — see fix
#7 below). A local dev server was set up and pointed at Trade X to
verify things visually; testing surfaced the schema-drift issues noted
above. Known still-broken from that testing pass, not yet triaged:
some "multiple rows returned" errors on journal/confluences queries
(possibly duplicate test data), and 500 errors generating Nova tips
(possibly a missing OPENAI_API_KEY secret in Trade X's own Vault —
secrets are per-project and need to be re-added there separately from
whatever was configured on the old cdyxs project).
4. **[DONE — migration `20260813211517`, applied directly to Trade X,
   2026-08-13]** Subscription enforcement server-side, not just in
   `PrivateRoute`. The paywall was only a client-side UI gate — a free
   user could open the browser console and pull full paid data
   directly. Fixed: added a `has_active_subscription()` database
   function (mirrors the existing client-side access logic) and
   required it on all 84 RLS policies across the 23 paid-feature
   tables. `user_profiles`, `subscriptions`, and `notifications` stay
   ungated on purpose. Verified directly: an unsubscribed test account
   gets rejected with an RLS error on insert; the same account with an
   active subscription row passes through.
5. **[DONE — commit `9c5e770`, undeployed from Trade X, 2026-08-13]**
   Delete `setup-stripe-product` and the `cloudflare-worker` folder
   entirely. The Stripe setup function had no login check at all, and
   the Cloudflare worker was an open, unauthenticated proxy that could
   be pointed at any URL. Confirmed: broker/MetaTrader connections are
   being removed as a feature entirely (see fix #8), so the worker had
   no remaining purpose. **Caveat:** this repo had no deployment config
   for the worker, so if a live copy still exists on Cloudflare outside
   this repo, it needs to be taken down manually from the Cloudflare
   dashboard — deleting the source file here doesn't reach it.
6. **[DONE — commit `5007aa6`, migration `20260813215121`, deployed to
   Trade X, 2026-08-13]** Add rate limiting and a per-user daily quota
   to `nova-chat`. It wasn't authenticated properly — it trusted a
   client-supplied `user_id` from the request body, which also made a
   rate limit pointless on its own (trivially bypassed by sending a
   different fake id each time), so fixing identity was bundled in.
   Fixed: identity now comes from the verified JWT; added a 10/minute
   burst cap and 100/day quota per user via an atomic Postgres function;
   and — folded in after a cost question came up — added prompt
   caching, since the system prompt + tools turned out to be ~12,145
   tokens sent in full on every single message with no caching at all.
   All three verified for real against Trade X: a spoofed body user_id
   is ignored (usage lands on the real JWT user), the rate limiter caps
   a rapid burst at exactly the configured limit, and caching was
   confirmed with actual before/after `cache_read_input_tokens` numbers
   from the API, not just "the code looks right."
7. **[DONE — migration `20260813201659`, applied directly to Trade X,
   2026-08-13]** Fix the waitlist RLS policy — it allowed anyone,
   logged in or not, to read every collected email (`USING (true)`).
   This was done out of order/urgently since it was live and actively
   exposing 7 real signup emails, not just a theoretical risk. Fixed by
   dropping the public SELECT policy entirely (signup/INSERT still
   works for everyone, matches how the form was already calling it —
   no `.select()` after insert, so nothing broke).
8. **[DONE — commit `84d93d7`, undeployed from Trade X, 2026-08-13]**
   Delete dead broker code. **This turned out narrower than originally
   listed** — checked with the user first, and confirmed: `nova-tts`
   and `process-voice-journal` are both real, actively-used features
   (voice chat with Nova, and voice-dictated journal entries) and were
   NOT touched. `broker-api` and `brokerService.ts` also weren't
   deleted — they turned out to be the shared backend for manual
   account creation and CSV import too, not just MetaTrader live-sync,
   and those are real features. What actually got deleted: the
   MetaTrader auto-sync-only pieces — `metatrader-sync`, `mt4-webhook`,
   `sync-all-brokers`, the shared MetaApi connector library nothing
   else used, `metaApiService.ts`, and the three MetaApi-specific
   branches inside `brokerService.ts` (none of which were reachable
   from any UI component). **Known separate issue, not fixed here:**
   manual account creation and CSV import are currently broken against
   Trade X's real database — the live `brokers` table has different
   columns than the code expects (`display_name`/`supported` vs.
   `slug`/`status`/`category`) — same schema-drift pattern as
   elsewhere in this doc. That's its own follow-up repair, deliberately
   not bundled into this deletion.
9. Clean up the loose markdown files, `public_backup`, and the stray Vite
   timestamp file sitting in the project root.
10. **New, found during fix #8, not yet done:** fix `broker-api` and the
    account-connection UI (`AccountSelector`, `BrokerConnectionsList`,
    `CSVUpload`, `EditBalanceModal`) to work against Trade X's actual
    `brokers` table columns. Right now manual account creation and CSV
    statement import — both real, wanted features — are broken because
    the code expects columns (`slug`, `status`, `category`,
    `supports_auto_sync`) that don't exist on the live table (it
    actually has `display_name`, `supported`). Not a security issue,
    just broken functionality.

**[DONE — commit `621d5f5`, deployed to Trade X, 2026-08-13]** Not part of
the original security list — a separate request to switch Nova's AI
backend from OpenAI to Claude (Anthropic). `nova-chat` now calls Claude
Sonnet 5 instead of OpenAI's gpt-4o. Nothing outside that one file
changed — the frontend still gets back the exact same `{text,
tool_calls}` shape it always did. Uses `ANTHROPIC_API_KEY` (a new secret,
added to Trade X's Vault) instead of `OPENAI_API_KEY`. `nova-tts` and
`process-voice-journal` still use OpenAI — they weren't touched since
fix #8 deletes them entirely anyway. Verified end to end with a real key:
plain chat replies work, and the full tool-calling round trip (Claude
decides to log a journal entry → the entry actually gets written →
Claude confirms in natural language) works correctly, HTML formatting
rules and all.

## Before launch

- Two-account test on every table: create two test accounts and confirm
  neither can see or touch the other's data, on every feature.
- Terms of Service, Privacy Policy, and a not-financial-advice disclaimer.

## How to work with me

- I'm not a developer. Explain things in plain English, no jargon.
- One fix at a time. Commit to git after each one with a clear message,
  then stop and let me test before moving on. Never batch changes.
- If something is risky or irreversible, tell me before doing it.

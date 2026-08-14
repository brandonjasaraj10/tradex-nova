# TradeX Nova

## Project

TradeX Nova — a trading journal SaaS. React/Vite frontend, Supabase backend,
Stripe for payments, Claude (Anthropic) powers the Nova AI chat feature —
switched from OpenAI on 2026-08-13, see the note under "Fix order" below.
Pre-launch, but tradexnova.com is now live — see "Deployment & domain"
below for the full setup.

Git was initialized in this project on 2026-08-12 specifically so this
cleanup work is reversible. `.env` is gitignored and confirmed never
committed — it holds real API keys/secrets and must stay out of git.

**Visual/UI work:** check [BRAND_GUIDE.md](BRAND_GUIDE.md) first (added
2026-08-14) — it documents the app's actual colors, spacing, and type as
real Tailwind tokens (`brand-blue`, `brand-surface`, etc.), based on an
audit of the live pages, not the unused legacy `Button.tsx`/`.card` CSS
that also exist in this repo. Use the documented tokens for new UI code
rather than guessing between the two blues or three near-black
backgrounds already scattered through the app.

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

**Second-order consequence of that same schema-drift pattern, found and
fixed 2026-08-14 (migration `20260814050807`):** fixing
`create_default_folders()`'s column bug earlier in this session
(migration `20260813210423`) made new-user signup itself start working
— but the function's actual folder-creation logic turned out to be a
leftover Bolt-era design (three folders: "General", "Weekly Review",
"Trade Reviews", plus a "Notes" row written to a separate
`notes_folders` table the frontend never reads) instead of the app's
real, current default-folder model (exactly two: "Daily Journal" +
"Notes", both in `journal_folders`, confirmed by `Journal.tsx`'s own
`DEFAULT_FOLDERS` constant). Fixing a broken column reference isn't the
same as confirming the surrounding logic is still correct — the
function had been silently failing for so long that nobody could tell
its actual output was wrong until it started succeeding. Rewrote it to
match the app's real default folders and backfilled affected accounts.

**Local tooling set up this session** (not permanent — lives in the
session's scratchpad, would need reinstalling in a fresh session): the
Supabase CLI (no Docker available, so `--linked`/`db query` are used
instead of the Docker-dependent commands), the GitHub CLI (`gh`, used to
authenticate git push access — device-flow login, logged in as
`brandonjasaraj10`), and Node.js, all installed as standalone binaries
since neither `brew` nor `npm`/`node`/`gh` exist on this machine by
default. A Supabase Personal Access Token was provided by the user and
used to log in the Supabase CLI. `.claude/launch.json` runs the dev
server via a wrapper script that sets PATH before calling `npm run dev`,
since the spawned process doesn't inherit the session's PATH.

## Deployment & domain

**[DONE, 2026-08-14]** Went from "domain just purchased" to a fully live
site in one session:

- **Code**: pushed to GitHub at `github.com/brandonjasaraj10/tradex-nova`
  (repo didn't exist before this session). Before the first push, the
  entire git history was rewritten (`git filter-branch`) to remove two
  old files (`SECRETS_SETUP.md`, `SIMPLE_SETUP.md`) that had a real,
  live OpenAI key committed in them — those files were already deleted
  from the working tree in fix #9, but the key was still sitting in
  history. Repo had never been pushed anywhere before, so the rewrite
  was clean (nothing to reconcile with a remote).
- **Hosting**: Vercel, connected to the GitHub repo, auto-deploys on
  every push to `main`. `vercel.json` added with a SPA rewrite rule
  (every path → `index.html`) — without it, direct navigation to any
  route other than the homepage 404'd, since Vercel doesn't know this
  is a client-side-routed single-page app by default.
- **Environment variables**: all 6 real `VITE_*` values (Supabase URL/
  anon key, Stripe publishable key + both price IDs, early access code)
  added in Vercel's project settings. Two real deploy bugs hit and
  fixed here: (1) the Supabase anon key got saved with its value
  replaced by literal bullet/dot mask characters on a re-edit — always
  clear the field and paste fresh rather than editing a masked value;
  (2) `VITE_ELEVENLABS_*`/`VITE_METAAPI_TOKEN` are dead vars from
  already-removed features, correctly left out.
- **DNS**: `tradexnova.com` bought at GoDaddy. One A record
  (`@` → `216.198.79.1`) points it at Vercel; SSL provisioned
  automatically within minutes of DNS propagating.
- **Fixed opportunistically while going live** (all deployed and
  verified, not just committed): the clipped "g" descender on the
  landing page headline (`leading-tight` → `leading-normal` on a
  `bg-clip-text` gradient heading); the favicon, which was explicitly
  disabled and pointed at an unrelated old logo design — now uses
  `tradex_logo.png` (transparent, for the tab icon) with
  `trade_x_logo.png` (solid background) for the `og:image`/
  `twitter:image` social-share preview, which was missing entirely.
- **Password reset was completely broken** (found while checking
  whether it used Resend) — same schema-drift pattern as everywhere
  else in this project. Fixed: see migration
  `20260814202608_fix_password_reset_codes_schema_drift.sql`.

**Email, via Resend:**
- Password reset and (per user) all transactional/campaign email should
  go through Resend, not Supabase's default email. `RESEND_API_KEY` is
  configured in Trade X's Vault. `tradexnova.com` needed its own
  separate DNS verification in Resend (SPF/DKIM — different records
  from the ones added for Vercel) before send would actually work;
  added those 3 records at GoDaddy and verification completed.
  The domain's "Enable Receiving" MX record (inbound email) has been
  sitting unconfigured/unverified since the domain's original setup 8
  months ago — unrelated to sending, not used by anything in this app,
  left as the user's call whether to disable it or ignore it.
- **Waitlist → Resend**: not connected to any email before this. Built
  `resend-waitlist-sync` edge function + a `pg_net`-based Postgres
  trigger (`20260814205619_sync_waitlist_signups_to_resend.sql`) so
  every new waitlist signup automatically gets added as a Resend
  contact in a "Waitlist" **segment** (Resend deprecated "Audiences" in
  favor of Segments — checked current docs rather than building on the
  deprecated one). All 7 existing real signups were backfilled. This
  only adds contacts to Resend for a future campaign/broadcast — no
  broadcast has been sent yet, that's a manual step whenever the user
  wants to announce launch.

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

**[DONE — commits `621d5f5` and `e8032d2`, deployed to Trade X,
2026-08-13]** Not part of the original security list — a separate
request to switch Nova's AI backend from OpenAI to Claude (Anthropic).
Both `nova-chat` and `process-voice-journal` now call Claude Sonnet 5
instead of OpenAI's gpt-4o — nothing outside those two files changed,
same response shapes as before, so the frontend didn't need any
updates. Uses `ANTHROPIC_API_KEY` (a new secret, added to Trade X's
Vault) instead of `OPENAI_API_KEY` for those two.

`nova-tts` (Nova's spoken replies) **stays on OpenAI on purpose** —
confirmed with the user this is a real, wanted feature (voice chat
with Nova), not abandoned like the ElevenLabs env vars. It can't move
to Claude regardless: Anthropic's Claude API has no text-to-speech
capability at all — that's specific to the Claude consumer app, not
something exposed to third-party integrations. Options if OpenAI cost
for this becomes a concern later: ElevenLabs, or the browser's free
built-in `speechSynthesis` API (same free-browser-API pattern already
used for speech-to-text in `useVoice.ts`) — the user chose to keep
OpenAI for now since it sounds better.

Verified end to end with a real key: `nova-chat` — plain chat replies
work, and the full tool-calling round trip (Claude decides to log a
journal entry → the entry actually gets written → Claude confirms in
natural language) works correctly, HTML formatting rules and all.
`process-voice-journal` — sent a real transcript, got back correctly
extracted structured JSON (symbol, direction, P&L, title).

## Nova improvement initiative

Separate from the security list — user wants Nova to "get better over
time." Important constraint that shapes all three steps: **Claude
(Anthropic) doesn't offer fine-tuning**, so Nova's underlying model can
never be retrained on TradeX's data the way the Privacy Policy's
"training AI models" language implies. All three steps below are ways
to improve Nova without touching the model itself. Agreed order:

1. **[DONE — commit `c724c32`, migration `20260813231756`, deployed to
   Trade X, 2026-08-13]** Thumbs up/down feedback on Nova's replies.
   New `nova_message_feedback` table (RLS: owning user + active
   subscription, same shape as `nova_chat_messages`). Found and fixed a
   real bug while building this: displayed messages used a
   client-generated UUID that never matched the UUID actually saved to
   the database, so feedback (and the pre-existing realtime message
   subscription) couldn't reliably reference a freshly-sent message.
   Fixed by generating the ID client-side and passing it through to the
   insert. Buttons added to both places Nova's chat renders —
   `NovaWidget.tsx` (floating widget) and `NovaAssistant.tsx` (the main
   `/dashboard` → NOVA AI page, which turned out to be the primary one,
   not the widget). Verified end-to-end against Trade X: rating
   persists, switching up/down works, clicking the same rating again
   clears it, and feedback correctly re-attaches after a full page
   reload. This is a signal-collection mechanism only — nothing
   automatically acts on the ratings yet; reviewing them to manually
   improve Nova's system prompt/tools is a manual follow-up, not
   automated.
2. **[DONE — commit `2a93db0`, migration `20260814041248`, deployed to
   Trade X, 2026-08-14]** Cross-conversation memory. Turned out Nova
   already had half of this: the onboarding profile
   (`user_trading_profiles` — goals, risk tolerance, trading style, set
   once via "Personalize Nova") was already being fetched and injected
   into every system prompt, pre-existing and unrelated to this
   session's work. The actual gap was conversational memory — a brand
   new chat session had zero awareness of anything said in a previous
   one. Fixed with a new `nova_user_memories` table (same RLS shape as
   `nova_message_feedback`) and a new `remember_about_user` tool given
   to Claude, following the exact same tool-call pattern as the
   existing `log_journal_entry`/`analyze_trading_performance` tools —
   no new plumbing invented, reused what already worked. The 20 most
   recent saved facts get pulled into the system prompt on every
   message. User chose to keep this invisible for now (no "what Nova
   remembers about you" management screen) — can revisit if it matters
   later. Verified for real against Trade X: told Nova about a
   recurring problem in one session, forced a genuinely blank new
   session (cleared the local session ID), and asked whether it knew
   anything about the user already — Nova correctly recalled the fact
   without being told again.
3. **Not started, intentionally held.** Cross-user aggregate insights —
   anonymized patterns across all users to sharpen Nova's general
   advice. Needs real usage data to be meaningful; the app has zero
   real users right now, so there's nothing to aggregate yet. Revisit
   once there's been real usage post-launch.

**Test account note:** `claude-test-20260813@example.com` (id
`5c29d48e-5c8e-4a61-9f5f-e62bc04b9074`) is a standing test account on
Trade X. Its password was set to `ClaudeTest2026!` and it was given an
active subscription row (bypassing Stripe, direct DB insert) to verify
step 1 above, since Nova chat is one of the paywalled features. The
subscription was left active afterward since it's useful for testing
other paid features too; its test chat messages/feedback rows were
deleted to leave a clean slate.

## Before launch

- Two-account test on every table: create two test accounts and confirm
  neither can see or touch the other's data, on every feature.
- **[DONE — commit `c565b80`, 2026-08-13]** Terms of Service, Privacy
  Policy, and Risk Disclaimer already existed (`src/pages/TermsOfService
  .tsx`, `PrivacyPolicy.tsx`, `RiskDisclaimer.tsx`) — reviewed for
  accuracy against the current product, not rewritten from scratch.
  Fixed: removed claims that TradeX actively syncs data with broker
  APIs/MetaTrader (that feature was deleted in fix #8 and doesn't exist
  right now — user's call to pull the language now and re-add when
  broker sync actually ships again; this shifted Terms of Service
  section numbering 7-18 down by one). Fixed a leftover
  `privacy@tradexnova.com` contact reference in the Privacy Policy — the
  other five contact blocks across all three pages already used
  `tradenovaai@gmail.com`. Refreshed the "Last Updated" date on all
  three (previously December 2024). Confirmed the "7-day free trial"
  claim in Terms of Service is accurate and should stay as-is.
  **Not fixed, tracked separately:** the Privacy Policy still says user
  data is used to "train and improve NOVA AI models" — not true today
  (Nova just calls Claude's API; no model training happens). User wants
  to actually build that data-driven improvement pipeline rather than
  change the wording, so the doc claim stays for now on the assumption
  it becomes true. This is a real, separate engineering project (data
  aggregation/anonymization pipeline), not a doc fix — needs its own
  scoping whenever it's picked up.

## How to work with me

- I'm not a developer. Explain things in plain English, no jargon.
- One fix at a time. Commit to git after each one with a clear message,
  then stop and let me test before moving on. Never batch changes.
- If something is risky or irreversible, tell me before doing it.

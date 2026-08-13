# TradeX Nova

## Project

TradeX Nova — a trading journal SaaS. React/Vite frontend, Supabase backend
(managed via Bolt), Stripe for payments, OpenAI powers the Nova AI chat
feature. Pre-launch: zero real users yet. Domain is tradexnova.com.

Git was initialized in this project on 2026-08-12 specifically so this
cleanup work is reversible. `.env` is gitignored and confirmed never
committed — it holds real API keys/secrets and must stay out of git.

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
3. **[DONE — commit `2efb95c`, 2026-08-12]** `activate-subscription` —
   require real Stripe verification. Anyone could grant themselves a
   free paid subscription by calling the function directly with no
   payment (there was even a public "Activate Subscription (Testing)"
   button on the Payment/Settings pages doing exactly this). Fixed: the
   function now looks the subscription up in Stripe itself and only
   writes what Stripe actually reports for that verified user — no
   more trusting a client-supplied duration. Note: the "Activate
   Subscription (Testing)" button will now correctly show an error for
   anyone who hasn't actually paid through Stripe — that button's copy/
   visibility should get cleaned up as part of fix #4 or #9.
4. Subscription enforcement server-side, not just in `PrivateRoute`. The
   paywall is currently only a client-side UI gate — a free user can open
   the browser console and pull full paid data directly.
5. Delete `setup-stripe-product` and the `cloudflare-worker` folder
   entirely. The Stripe setup function has no login check at all, and the
   Cloudflare worker is an open, unauthenticated proxy that can be pointed
   at any URL.
6. Add rate limiting and a per-user daily quota to `nova-chat`. It's not
   authenticated properly today, so anyone can hit it and run up the
   OpenAI bill.
7. Fix the waitlist RLS policy — it currently allows anyone to read every
   collected email (`USING (true)`).
8. Delete dead broker and voice code: `nova-tts`, `process-voice-journal`,
   `broker-api`, `metatrader-sync`, `mt4-webhook`, `sync-all-brokers`,
   plus `src/services/metaApiService.ts` and `brokerService.ts`. These
   need to be un-deployed from Supabase too, not just deleted as files —
   deleting the file alone leaves the function live.
9. Clean up the loose markdown files, `public_backup`, and the stray Vite
   timestamp file sitting in the project root.

## Before launch

- Two-account test on every table: create two test accounts and confirm
  neither can see or touch the other's data, on every feature.
- Terms of Service, Privacy Policy, and a not-financial-advice disclaimer.

## How to work with me

- I'm not a developer. Explain things in plain English, no jargon.
- One fix at a time. Commit to git after each one with a clear message,
  then stop and let me test before moving on. Never batch changes.
- If something is risky or irreversible, tell me before doing it.

# Launch email — draft

**To:** the 11 waitlist signups (Resend "Waitlist" segment) — nobody else
**Send:** Sunday 23 Aug 2026, shortly after 10:00 PM MDT
**Founder pricing closes:** Tuesday 25 Aug 2026, 10:00 PM MDT (2 days)
**Format:** plain text, personal, from Brandon
**One call to action:** start the free trial

Plain text over designed HTML on the research: ~42% vs ~23% open rates,
21% higher click-to-open, and 2–3× the reply rate — plus better inbox
placement, which matters because tradexnova.com has almost no sending
history and a heavy HTML send to a fresh domain is what filters distrust.
These 11 people signed up after watching a founder video; an email that
reads like a person wrote it matches what they opted into.

---

## Subject line — pick one

1. `TradeX Nova is live` — shortest, cleanest, no hype
2. `It's live — and your founder price is locked` — leads with their benefit
3. `You're in — TradeX Nova is live` — leads with belonging

Recommend **2**. Under 45 characters, states the benefit that is actually
theirs, and doesn't manufacture pressure.

**Preview text:** `Your $14.99 never rises. Here's how to get started.`

---

## Body

Hi {{first_name}},

TradeX Nova is live.

You joined the waitlist before launch, so your founder pricing is locked
in: TradeX Pro at **$14.99/month** instead of $24.99 — and that price never
rises for as long as you stay.

You have until **Tuesday at 10PM MDT** to claim it. After that it closes and
the price goes to $24.99.

**→ Start your free trial: https://www.tradexnova.com**

Seven days free before anything is charged, and you can cancel any time.

Here's what you're getting:

- A journal that understands what you actually trade — forex, futures,
  options, stocks and crypto, not just a generic notes app
- NOVA, an AI that reads your entries and tells you what you keep doing
  wrong. Talk to it, or type messy notes and let it organise them
- Psychology tracking, so the pattern behind the losing days becomes
  something you can see instead of something you feel
- Import your history from any broker with a CSV, or log a trade by voice
  in about ten seconds

I built this because I needed it and nothing out there did the job. I was
keeping notes in spreadsheets that never told me anything useful about my
own trading.

If something's broken or missing, just reply — this comes straight to me,
and I'll read every one.

Thanks for waiting.

Brandon
Founder, TradeX Nova

---

## Before this can go out

1. ~~Cutoff not enforced~~ — **done.** `is_founder_eligible()` now closes
   at Tue 25 Aug 2026 10:00 PM MDT, enforced server-side, so the deadline in
   this email is real rather than a claim.

2. **No real payment has ever completed.** Worth one real $14.99 charge
   (refundable) before sending, so the first person through isn't the test.

3. **Personalisation:** confirm Resend has first names for these contacts.
   If not, drop `{{first_name}}` and open with "Hi," — a broken merge tag
   in the first line undoes the personal tone the format is buying.

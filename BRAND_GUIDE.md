# TradeX Nova — Brand Guide

This documents the visual language the app actually uses today, based on
an audit of the real, live pages (not the old `.btn-primary`/`.card` CSS
classes in `index.css`, which are leftovers from an earlier design pass
and don't reflect what the app looks like now).

**Purpose:** give new code a single, named source of truth to reach for,
instead of guessing between two shades of blue or three near-identical
near-black backgrounds. The values below are also defined as real
Tailwind tokens in `tailwind.config.js` (`brand-blue`, `brand-surface`,
etc.) — use those classes in new code rather than raw hex codes.

This guide does **not** change any existing page — it's a reference for
new and future work. Existing inconsistencies (like the calendar fix)
get cleaned up opportunistically, not in one big sweep.

## Colors

### Blue (the brand accent)

Two shades, each with a specific job — this isn't arbitrary, it's how
the app already uses them almost everywhere:

| Token | Hex | Tailwind class | Use for |
|---|---|---|---|
| `brand-blue` | `#3B82F6` | `bg-brand-blue`, `text-brand-blue` | **Solid fills**: icon backgrounds, glow/shadow effects, gradients, selected/active states |
| `brand-blue-light` | `#60A5FA` | `bg-brand-blue-light`, `border-brand-blue-light` | **In-app only** — text, borders, hover/ring states on dark backgrounds inside the product. The public pages no longer use it: see "One blue in front" below |

Rule of thumb: if it's a filled shape (an icon's background square, a
selected calendar day, a button), use `brand-blue`. If it's an outline,
label, or subtle highlight inside the product, use `brand-blue-light`. On the
public pages, use `brand-blue` for that too.

### One blue in front

Everything a visitor sees before they sign up — the landing page, Features,
Nova, Pricing, Security, FAQ, Affiliates, the paywall, the legal pages and
everything in `components/marketing/` — uses **`brand-blue` (`#3B82F6`) for
text, borders and chart strokes**, not `brand-blue-light`.

The lighter blue is easier on the eye and that is exactly the problem out
front: it reads tentative. The deeper blue reads bold and certain, which is
the register the marketing surface is supposed to be in, and it matches what
the Instagram carousels have been using — the same blue in an ad and on the
page it links to.

It still passes AA on black at 5.3:1, so this is a confidence choice rather
than a legibility trade.

Inside the product, `brand-blue-light` stays. There the job is sustained
readability across long sessions, not making an argument.

### Backgrounds

Three tiers, darkest to lightest:

| Token | Hex | Use for |
|---|---|---|
| `brand-bg` | `#000000` | The page itself |
| `brand-surface` | `#0A0A0A` | Cards and panels sitting on the page |
| `brand-elevated` | `#111111` | Things sitting on top of a card — inputs, nested panels |

### Status colors — profit/loss

| Token | Hex | Use for |
|---|---|---|
| `brand-profit` | `#60A5FA` (same as `brand-blue-light`) | Gains, wins, positive P&L |
| `brand-loss` | `#9CA3AF` (grey, not red) | Losses, negative P&L |

Deliberately blue/grey, not the green/red most trading apps default to.
This isn't a guess — it's already how the app's two most-used trading
views work: `Calendar.tsx`'s P&L view and `Analytics.tsx`'s stat cards
both color gains `text-blue-400` and losses/flat `text-gray-400` (or
`text-slate-300`), and even the marketing page's demo calendar
(`Sales.tsx`) follows the same pattern. A handful of other places
(`BalanceCard.tsx`, CSV import, broker balance display) used green/red
instead — those were brought in line with the blue/grey pattern.

**This is specifically about profit/loss, not every red/green in the
app.** Destructive actions (delete buttons), error states, and
connection-status badges ("Active"/"Error" on a broker connection) are
a different, unrelated use of red — those stay red. Only change a
color if it's representing a gain or a loss.

### Borders

- Default/subtle: `border-white/10` — this is already the dominant
  pattern (used ~226 times) and doesn't need a new token, just keep
  using it.
- Very faint (barely-there dividers): `border-white/5`
- Accent border (active/focus/hover on something blue): `border-brand-blue-light` in-app / `border-brand-blue` out front, at 20–50% opacity depending on how much emphasis it needs (`/20` subtle, `/50` prominent)

## Shape

- Small elements and buttons: `rounded-lg`
- Cards and panels: `rounded-xl` (standard) or `rounded-2xl` (larger panels)
- Circular elements (avatars, icon badges, pills): `rounded-full`

## Typography

- Font: Inter (already the only font in use — `font-sans` covers it, no
  change needed)
- Page titles: `text-2xl sm:text-3xl font-bold`
- Card/section titles: `text-lg font-medium`
- Body text: `text-sm`, with `text-gray-400` for secondary/muted text

## The public-page design language (added 2026-09-13)

Everything above describes the **logged-in app**. The marketing side —
the landing page, `/features`, `/nova`, `/pricing`, `/security`,
`/for-prop-firm-traders`, `/about`, `/faq`, `/affiliates`, the legal
pages and the paywall — was rebuilt on a tighter system that differs in
three specific ways. New public-facing work should follow it.

**See [TRADEX_BRAND_KIT.md](TRADEX_BRAND_KIT.md)** for the full version,
including voice and copy rules. That file is deliberately self-contained
so it can be handed to a designer or pasted into a chat with no repo
access. The short version for engineers:

1. **Type is semibold with negative tracking, never bold.**
   `font-semibold` + `tracking-[-0.035em]` on headings; the tracking
   tightens as the size grows (-0.04em on a hero, -0.02em on a card
   heading). Bold at default tracking is what made the old pages read as
   generic. **No gradient text** — a white-to-grey headline reads as
   dimming out, not emphasis.

2. **The primary CTA is a white pill with black text**, `rounded-full`.
   Secondary is a transparent pill with a `white/15` border. Blue
   rectangular buttons are the previous language.

3. **Sections are separated by a `white/[0.06]` rule and vertical
   space, not by stacking cards.** Four bordered boxes in a row read as
   one undifferentiated block, especially on a phone. Break the rhythm
   with a real interface panel beside its explanation (sides
   alternating), a full-width band of numbers, or a pull quote.

Shared building blocks, so this does not get reinvented per page:

- `src/components/layout/PageShell.tsx` — header, measure, footer for
  every public page outside the landing page
- `src/components/layout/LegalProse.tsx` — one type treatment for the
  three legal pages
- `src/components/marketing/blocks.tsx` — `Section`, `Split`, `Card`,
  `TickList`, `QA`, `Steps`, `ClosingCta`
- `src/components/marketing/product.tsx` — `Frame`, `StatBand`,
  `PullQuote`, and the product panels (calendar, checklist, permissions,
  accounts, weekly report, timeline)
- `src/components/marketing/exampleScore.ts` — the one example NOVA
  Score breakdown every page shares, so no two pages quote different
  numbers for the same screenshot

**Two rules that are easy to get wrong:**

- **Use the real component where one exists.** `/features` and
  `/pricing` import the actual `NOVAScore` and `PreTradeScales` rather
  than redrawing them, so a marketing page cannot drift from the product
  it is selling.
- **Looping animations must not move the page.** Reserve the finished
  size before the animation starts by rendering the final content
  invisibly in normal flow and painting the animated copy on top (see
  `NovaAnswer.tsx`). A `min-height` guess in `em` cannot know how many
  lines text wraps to at an arbitrary width — the one that was there
  reserved 98px for text that needed 214px on a 320px phone.

## Known inconsistencies not fixed by this guide

These exist in the app today. They're not urgent, but worth knowing
about so nobody assumes they're intentional:

- **`index.css`'s `.card`/`.btn-primary`/`.input-field` classes** use
  yet another background shade (`#111`/80% opacity) and a white/black
  button style, inconsistent with the blue-accented, `#0A0A0A`-card
  look the actual pages use. Some older code may still reference these.

- **[Measured 2026-08-19, partly fixed since] `gold-*` is still undefined.**
  Payment.tsx's 29 usages were converted to real brand tokens on
  2026-09-13 as part of bringing the paywall on brand, and Footer.tsx's
  were fixed earlier. The remaining usages across twelve other files are
  still there and still deliberately deferred.
  The `Button.tsx` fix below only covered that one component. `gold-400`
  /`gold-500` are *not* defined in `tailwind.config.js` or `index.css`,
  yet 149 usages remain across 14 files (Sales, Payment, Settings,
  Dashboard, Footer, NotFound, WaitlistCapture, SplashScreen,
  LoadingScreen, NOVAScore, TradeXScore, AccountSelector, CSVUpload,
  BrokerConnectionsList).

  Undefined utilities fail *differently* depending on the property, so
  what renders today is accidental rather than designed — measured live
  on `/sales`, where 97 gold-classed elements produce 12 distinct
  renderings:
  - `text-gold-400` → no rule emitted, so text inherits: renders **white**
  - `bg-gold-400/20`, `from-/to-/via-gold-*` → **nothing at all**
  - `border-gold-400/30` → falls back to Tailwind's default border
    colour, **`#e5e7eb` light grey**
  - `from-white to-gold-400/70` + `bg-clip-text` (the "TradeX Pro"
    pricing heading) → gradient runs white → **transparent**, so the
    heading fades out. That fade is a side effect of the missing colour,
    not a design decision.

  Deliberately left alone: it's cosmetic, it currently looks good, and
  the owner's call (2026-08-19) was not to touch it right before launch.
  Fixing it is a real fork, not a find-and-replace — either define a
  genuine gold palette and accept that ~149 spots visibly change, or
  hardcode today's accidental rendering and lock it in permanently.
  Worth doing as part of a deliberate design pass, not in passing.

None of this needs an urgent fix — it's here so future work (including
future Claude Code sessions) doesn't mistake old leftovers for the
current design.

## Fixed since this guide was written

- **2026-08-14 — `Button.tsx` was not dead code**, as this guide first
  claimed. It's actually imported in 16 files (Auth, Dashboard, Payment,
  Settings, and more) — its colors just referenced an undefined
  `gold-400`/`dark-700` palette, so every button using it rendered with
  no visible background or border at all. Fixed to use real brand-blue
  tokens; see git history for the commit.
- **2026-08-14 — Profit/loss standardized on blue/grey** (see Status
  colors above) — `BalanceCard.tsx`, CSV import, and broker balance
  display previously used green/red and were brought in line.

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
| `brand-blue-light` | `#60A5FA` | `bg-brand-blue-light`, `border-brand-blue-light` | **Text, borders, hover/ring states** on dark backgrounds — the lighter shade reads better against black than the solid fill color does |

Rule of thumb: if it's a filled shape (an icon's background square, a
selected calendar day, a button), use `brand-blue`. If it's an outline,
label, or subtle highlight, use `brand-blue-light`.

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
- Accent border (active/focus/hover on something blue): `border-brand-blue-light` at 20–50% opacity depending on how much emphasis it needs (`/20` subtle, `/50` prominent)

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

## Known inconsistencies not fixed by this guide

These exist in the app today. They're not urgent, but worth knowing
about so nobody assumes they're intentional:

- **`index.css`'s `.card`/`.btn-primary`/`.input-field` classes** use
  yet another background shade (`#111`/80% opacity) and a white/black
  button style, inconsistent with the blue-accented, `#0A0A0A`-card
  look the actual pages use. Some older code may still reference these.

- **[Measured 2026-08-19] `gold-*` is still undefined, in 149 places.**
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

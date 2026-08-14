# TradeX Nova — Brand Guide

This documents the visual language the app actually uses today, based on
an audit of the real, live pages (not the unused legacy `Button.tsx`
component or the old `.btn-primary`/`.card` CSS classes in `index.css` —
those are leftovers from an earlier design pass and don't reflect what
the app looks like now).

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

### Status colors

| Token | Hex | Use for |
|---|---|---|
| `brand-profit` | `#4ADE80` | Gains, wins, positive stats |
| `brand-loss` | `#F87171` | Losses, errors, destructive actions |

(A few places use `emerald-400`/`green-500` instead of `green-400` for
profit — that's legacy drift, not a second intentional color. Treat
`brand-profit` as the one to use going forward.)

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

- **The `Button.tsx` shared component** (`src/components/shared/Button.tsx`)
  uses a gold/dark color scheme (`gold-400`, `dark-700`) that isn't
  defined anywhere and isn't used anywhere either — it's dead code from
  an earlier design. Most buttons in the app are hand-styled per
  component instead of using a shared component.
- **`index.css`'s `.card`/`.btn-primary`/`.input-field` classes** use
  yet another background shade (`#111`/80% opacity) and a white/black
  button style, inconsistent with the blue-accented, `#0A0A0A`-card
  look the actual pages use. Some older code may still reference these.
- **Green for profit** is split between `green-400` and `emerald-400`
  in a few places — `brand-profit` (`green-400`) is the one to
  standardize on.

None of this needs an urgent fix — it's here so future work (including
future Claude Code sessions) doesn't mistake old leftovers for the
current design.

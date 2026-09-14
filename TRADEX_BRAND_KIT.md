# TradeX Nova — Brand Kit

**A self-contained brief. Paste the whole file into a chat, hand it to a
designer, or work from it yourself. It assumes no other context.**

For engineers working in this repo, `BRAND_GUIDE.md` is the companion
document: it covers the in-app Tailwind tokens. This one covers the voice,
the visual language, and the rules — the things an ad, a landing page or a
new screen all need to get right.

---

## 1. What TradeX is

A trading journal built around psychology. A trader talks through a trade out
loud; TradeX writes the journal entry, and an AI called Nova reads every entry
together and tells them the habit costing them money.

**One plan, $24.99/month.** 14-day money back guarantee. Up to five accounts.

### Who it is for

Retail traders — forex, futures, stocks, crypto — and especially **prop firm
challenge takers**, who are the sharpest segment: a large, clearly defined
group with one expensive, recurring failure.

### The core insight everything comes from

> Journals do not fail on features. They fail at 4pm.

Nobody abandons a journal because it was missing a chart. They abandon it
because typing up a trade is the last thing anyone wants to do after taking
one. So the first problem TradeX solved was the typing, not the analytics.

The second insight, and the actual differentiator:

> Every journal shows you that you lost. Almost none of them record why.

Competitors have a hundred features and none of them track the thing that
decides whether you made money — what was going on in your head when you
clicked buy.

---

## 2. Voice

### The rule

**Plain, specific, and never overstated.** Write like a trader talking to
another trader, not like a SaaS company talking to a market.

### What that means in practice

| Do | Don't |
|---|---|
| "Talk through the trade." | "Leverage voice-driven workflows." |
| "You moved your stop on 4 of your last 6 losers." | "Gain powerful insights into your behaviour." |
| "Thirty seconds a trade." | "Streamline your journaling process." |
| "Never touches your money." | "Bank-grade security." |
| "No, and anyone telling you otherwise is selling something." | Dodging the question. |

### Five specific habits

1. **Concrete beats abstract.** Name the thing a person does, not the
   category it belongs to. "Talk through the trade" works; "bridges the gap
   from identity to execution" does not — the reader has three seconds and no
   patience for your vocabulary.

2. **Short sentences carry the weight.** A two-word fragment after a long
   sentence lands harder than a clause hung off an em-dash. *"...the thing
   that actually decides whether I make money. My trading psychology."*

3. **Say the uncomfortable thing.** The most persuasive copy on the site is
   where it declines to oversell: *"Will it make me profitable? No, and
   anyone telling you otherwise is selling something."* Honesty is the
   differentiator, not a constraint on it.

4. **Objections, not features.** Every headline should answer a reason
   somebody does not buy. "No spreadsheets." "Never touches your money."

5. **Sentence case, always.** Headings and buttons are sentence case, not
   Title Case. "What you actually get", not "Everything You Need To Succeed".

### Things that must never appear

- **Invented numbers.** No user counts, no "2,500+ traders", no star ratings,
  no fabricated pass rates. There are no such figures yet, and the payment
  and security pages are the worst possible place to be caught out.
- **Compliance badges TradeX does not hold.** No SOC 2, no ISO, no "GDPR
  certified". The security page says so outright and argues from architecture
  instead.
- **Promises the product does not keep.** It has no capital-protection tools,
  it gives no trading advice, and it does not make anybody profitable.
- **Fake urgency.** No countdown timers. Real deadlines only — the MT4/MT5
  price rise is genuine, so it can be said.

---

## 3. Colour

Black, white, grey, and exactly one blue. **No gold, no green, no red.**

| Role | Hex | Notes |
|---|---|---|
| Page background | `#000000` | True black |
| Card / panel | `#0A0A0A` | Sits on the page |
| Nested / input | `#111111` | Sits on a card |
| Blue, solid fills | `#3B82F6` | Icon backgrounds, glows, gradients |
| Blue, text & borders | `#60A5FA` | Reads better than the solid fill on black |
| Primary text | `#FFFFFF` | |
| Body text | `#9CA3AF` (gray-400) | |
| Muted / captions | `#6B7280` (gray-500/600) | |
| Borders, subtle | `rgba(255,255,255,0.07)` | The default divider |
| Borders, faint | `rgba(255,255,255,0.06)` | Section rules |

### The blue rule

Blue is **the accent, spent sparingly, where it means something.** The hero is
deliberately monochrome so that the first blue on the page is the product
panel. Inside the product, blue marks what TradeX worked out — a tag Nova
assigned, a winning day, a score.

### Profit and loss are blue and grey, not green and red

Gains `#60A5FA`, losses `#9CA3AF`. This is deliberate and it is what the app
already does. Red and green stay for genuinely destructive actions and error
states only.

---

## 4. Typography

**Inter**, throughout. The whole system is weight and tracking, not font
variety.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero headline | 46px mobile / 80px desktop | 600 | -0.04em |
| Page title | 34px / 48px | 600 | -0.035em |
| Section heading | 26px / 32px | 600 | -0.032em |
| Card heading | 15–17px | 500–600 | -0.01em |
| Body | 14.5px / 16px | 400 | normal, 1.6–1.75 line height |
| Small print | 11.5–13px | 400 | normal |
| Eyebrow label | 10px | 400 | **+0.16em, uppercase**, grey-600 |

### Two rules that do most of the work

1. **Semibold, never bold.** `font-semibold` (600) with negative tracking.
   Bold at default tracking is what made the old pages look generic.
2. **Negative tracking scales with size.** The bigger the type, the tighter
   it sets. -0.04em on a hero, -0.02em on a card heading, normal on body.

**No gradient text.** A white-to-grey gradient headline reads as the headline
dimming out, not as emphasis. Solid white.

---

## 5. Layout and shape

- **Radius:** `rounded-full` for buttons, pills and tags. `rounded-xl` (12px)
  for nested panels. `rounded-2xl` (16px) for cards and the outer frame.
- **Buttons:** the primary CTA is a **white pill with black text**, always.
  Secondary is a transparent pill with a `white/15` border. Blue rectangular
  buttons are the old language — don't.
- **Sections** are separated by a `white/[0.06]` top border and 48–112px of
  vertical padding, not by cards stacked on cards.
- **Mobile first.** Nearly all traffic is mobile. Nothing may scroll
  horizontally, ever. Test at **320px**, not just 375px.

### The anti-pattern to avoid above all

**Card, card, card, card.** Four sections of the same bordered box read as one
undifferentiated block, and on a phone they collapse into a column of
identical grey rectangles. Break the rhythm deliberately:

- A **real piece of interface** beside the sentence explaining it, sides
  alternating down the page
- A **full-width band of three numbers**, no boxes
- A **pull quote** at 24–34px with nothing else on screen

On mobile, the visual comes **first** and the text second — someone scrolling
a phone decides whether to keep going from what they can see.

---

## 6. Showing the product

**Show the interface. Do not describe it.** The highest-converting pages lead
with real screenshots and embedded previews; an interactive piece draws
roughly twice the engagement of a static image, provided the point lands in
seconds.

Rules that keep it honest:

1. **Use the real component** wherever one exists, not a redrawn copy, so the
   marketing cannot drift away from the product.
2. **Match the product's own colours and labels.** If the app renders tags as
   blue pills, the marketing shows blue pills.
3. **Every panel with figures says "Example figures."**
4. **Plausible, not flattering.** An example NOVA Score of 78 with discipline
   as the weakest component is believable. Straight 90s are not, and this
   audience spots it.
5. **Check the details are possible.** An example month must not show trades
   closing on a Saturday.

---

## 7. Motion

Restrained. Motion earns its place by explaining something.

- **Nothing moves the page while someone is reading it.** Looping animations
  must reserve their finished size before they start — render the final text
  invisibly underneath and paint the animated copy on top. A `min-height`
  guess in `em` is not good enough; it cannot know how many lines the text
  wraps to on a given phone.
- **A page change is not a scroll.** Navigation jumps to the top instantly;
  it never animates.
- **Swipes follow the finger.** A gesture that only acts on release reads as a
  glitch.
- Standard easing: `cubic-bezier(0.22, 0.61, 0.36, 1)` at 320–420ms.
- **Always honour `prefers-reduced-motion`**, and always leave the resting
  state as the finished state, so a reader who never sees the animation still
  gets the point.

---

## 8. The proof points that are true

Use these freely. They are all verifiable today.

- One plan, $24.99/month, everything included
- 14-day money back guarantee, cancel in two clicks, no retention call
- Up to 5 accounts, each scored separately
- Thirty seconds to log a trade by voice
- Never places, closes or modifies a trade — structurally cannot
- Card details never reach TradeX; Stripe handles payment end to end
- Row-level security per user, tested with two real accounts against the API
- Nova is built on Claude (Anthropic), which does not train on API data
- MT4/MT5 sync ships shortly and is read-only when it does

**Not yet true, do not claim:** any user or revenue figure, any compliance
certification, any profitability outcome.

---

## 9. Quick reference for an ad

- **Hook:** the failure, named precisely. *"You did not fail the challenge on
  strategy. You failed it on a rule you already knew."*
- **Mechanism:** *"Talk through the trade. TradeX writes the entry."*
- **Payoff:** *"You moved your stop on 4 of your last 6 losers."*
- **CTA:** *"Start journaling"* — white pill, black text.
- **Reassurance line:** *"14-day money back guarantee · Cancel anytime"*
- **Look:** black, one blue accent, Inter semibold with tight tracking, real
  interface rather than stock imagery.

# Design System — hitchat

The visual language for the anonymous lab chat. Every value here is a decision, not a
default. If you are implementing and something is not specified, ask rather than
reaching for a Tailwind or shadcn default.

---

## Concept: the lab record file

The artifact at the center of this product's world is the **lab record file** — ruled
paper, a red margin rule down the left, code written out in blue ballpoint, dated at
the top. That physical object is the source of every choice below.

This matters because "warm and soft" on its own lands on the same cream-and-terracotta
page that every AI-generated design produces right now. Grounding it in the record file
gives the warmth a reason and gives us a signature nobody else's chat app has.

**What this is not:** not a terminal theme, not a Discord clone, not glassmorphism.
When in doubt, ask "would this belong on a sheet of lab paper?"

---

## Color

Six tokens per theme. **Each has exactly one job.** Do not invent new colors; if you
need a shade, derive it from an existing token with opacity.

### Light

| Token | Hex | Job |
|---|---|---|
| `paper` | `#FAF5F1` | page background |
| `ink` | `#241E1A` | body text, headings |
| `pen` | `#2C5F8F` | primary buttons, links, focus ring, own-message accent |
| `rule` | `#C8503F` | code-card margin rule, destructive actions |
| `marigold` | `#E5A03A` | SUDO badge, pinned strip — nothing else |
| `graphite` | `#6E645C` | timestamps, meta, faded text |

### Dark

| Token | Hex | Job |
|---|---|---|
| `desk` | `#1A1613` | page background |
| `chalk` | `#EDE6DE` | body text, headings |
| `pen` | `#7FB0DC` | as above |
| `rule` | `#D9705F` | as above |
| `marigold` | `#F0B657` | as above |
| `graphite` | `#9A8F86` | as above |

### Author colors

Handles are **derived** from a hashed token, never chosen, so this palette is a
lookup table indexed by a hash slice — not a set of options anyone picks from.

**One job: telling speakers apart in a busy stream.** Nothing else uses these. They
are not a general-purpose accent set, and reaching for one to decorate a button or a
border defeats the point — the moment these appear outside a handle, a colored name
stops meaning "a specific person".

*Amended 2026-08-30 — identity is color **and** shape.* Color alone stops working for a
color-blind reader, so each slot also carries a drawn SVG glyph (circle, square,
triangle, diamond, plus, hexagon, ring, spark) rendered in the slot's color. The glyph
is derived from the same stored hex as the color, so one author reads the same
everywhere — beside the handle, in the reply preview, and in the pinned strip. The two
cues always travel together; a shape never appears with a different color. `lib/
author-color.ts` resolves the hex to its slot (`authorIndex`) and the glyphs live in
`components/chat/author-mark.tsx`. Same precedent as the SUDO badge and fade-floor
amendments: a real accessibility gap fixed without a new color or font.

| # | Name | Light | Dark |
|---|---|---|---|
| 1 | rust | `#873C1D` | `#E49F81` |
| 2 | olive | `#6B6424` | `#C9BF5E` |
| 3 | fern | `#42602E` | `#8CB96E` |
| 4 | jade | `#257E44` | `#59CF82` |
| 5 | teal | `#2E5B60` | `#6EB2B9` |
| 6 | cobalt | `#2064B6` | `#498CDF` |
| 7 | violet | `#6B30A6` | `#A371D6` |
| 8 | magenta | `#8E295C` | `#D16199` |

**Why these exact values.** Three properties were verified numerically, not by eye,
and any replacement must be re-verified the same way:

- **Every swatch clears WCAG AA (4.5:1)** against its own theme's background. The
  tightest is jade on `paper` at 4.68:1.
- **Every swatch sits at least 20 ΔE from `pen`, `rule`, `marigold`, and `graphite`**
  in *both* themes. This is the constraint that matters most: a handle tinted near
  `pen` reads as a link, near `rule` as a destructive control, and near `marigold` as
  **an admin**. `marigold` is excluded outright — no handle may ever be mistaken for a
  SUDO badge.
- **The closest two author colors are 19.4 ΔE apart**, so two people in one room stay
  distinguishable.

**The set skews cool** — one warm slot against three cool ones. That is a direct
consequence of `rule` owning red-orange and `marigold` owning amber; the warm band is
genuinely occupied. Widening it means changing what those tokens own, which is a
deliberate decision to make on its own, not a side effect of adding an author.

**Handle names carry no color word.** A handle is one compact username token made from
two hash-picked syllables plus a 3-digit suffix (for example, `NixFox042`). The name
and colour come from different slices of the same hash, so a colour word like "Amber"
would eventually render in violet and contradict itself. The syllables deliberately
mix cool, playful, professional, Linux-style, and meme-adjacent language instead.

### Derived surfaces



| Purpose | Light | Dark |
|---|---|---|
| Raised surface (cards, composer) | `paper` lightened 2% | `desk` lightened 4% |
| Hairline border | `ink` @ 10% | `chalk` @ 12% |
| Hover wash | `ink` @ 4% | `chalk` @ 6% |
| Code card background | `paper` darkened 1.5% | `desk` lightened 6% |

### Rules

- **`marigold` is reserved.** It appears only on the SUDO badge and the pinned strip.
  The moment it decorates something ordinary, admin presence stops being scannable.
  It is excluded from the author palette for the same reason.
- **`pen` carries all interactivity.** Every focusable thing gets a `pen` focus ring,
  2px, 2px offset. No exceptions.
- **`rule` means margin or danger.** The code-card rule and destructive buttons. Never
  a decorative border.
- Contrast floor is WCAG AA (4.5:1 body, 3:1 large text and UI). `graphite` on `paper`
  measures 5.1:1 and is the lowest-contrast pairing permitted.

---

## Typography

Three faces, three jobs. All from Google Fonts, self-hosted with `next/font` — no
external requests, no layout shift.

| Role | Face | Used for |
|---|---|---|
| Display | **Bricolage Grotesque** | Room titles and the landing wordmark, only |
| Body | **Figtree** | All prose, messages, buttons, labels |
| Mono | **IBM Plex Mono** | Code bodies, line numbers, lab tags, timestamps, counts |

**No serif.** Serif display on a cream background is the single most common
AI-generated look right now. Bricolage's condensed, slightly irregular character does
the personality work instead.

Bricolage is used **sparingly and large** — under about 5 places on any screen. Its
quirk reads as intentional at 28px+ and as noise at body size.

### Scale

| Step | Size / line-height | Face | Use |
|---|---|---|---|
| Display | 32/36, weight 600, tracking -0.02em | Bricolage | Room title, wordmark |
| Title | 20/28, weight 600 | Figtree | Section headings, dialog titles |
| Body | 15/24, weight 400 | Figtree | Messages, prose |
| Small | 13/20, weight 500 | Figtree | Buttons, labels |
| Meta | 12/16, weight 500, tracking 0.02em | Plex Mono | Handles, timestamps, counts |
| Code | 13/21, weight 400 | Plex Mono | Code bodies |

Sentence case everywhere. No all-caps except the SUDO badge (11px, tracking 0.08em).

---

## Layout

Desktop-first. Two columns.

```
┌──────────┬────────────────────────────────────────┐
│ CSE      │  CSE · Batch 2 · Group A    ○ 12 here  │
│  ▸ B1    │  All · Lab 3 · Lab 4 · Lab 5           │
│  ▾ B2    ├────────────────────────────────────────┤
│    A ●   │  teal falcon    anyone done q2?        │
│    B     │  ┌─┬──────────────────────────────┐    │
│ IT       │  │ │ Lab 4 · Q2        c  ⧉ copy  │    │
│  ▸ B1    │  │1│ #include <stdio.h>           │    │
│          │  │2│ int main(){                  │    │
│ ─────    │  └─┴──────────────────────────────┘    │
│ ◐ theme  │   ✓ 4  ⚠ 1                             │
│          ├────────────────────────────────────────┤
│          │  [ message ]              [ </> code ] │
└──────────┴────────────────────────────────────────┘
```

- **Sidebar** 260px fixed, hairline right border, room tree with the current room
  marked by a `pen` dot. Theme toggle pinned to the bottom.
- **Header** two rows: room title (Bricolage) with presence count on the right; lab
  filter chips below. Pinned strip inserts between them when a pinned message exists.
- **Stream** max-width 720px, left-aligned within the column. Not centered — chat that
  centers itself reads as a marketing page.
- **Composer** fixed to the bottom of the stream column. Text input with a `</> code`
  button that swaps in the code composer.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Nothing off-scale.
- **Radius:** 6px on inputs and buttons, 8px on cards, 0 on the margin rule. Restrained
  — heavy rounding is what makes warm palettes read as generic.

**Mobile** (< 768px): sidebar becomes a drawer from a header button, stream goes full
width, code cards scroll horizontally. Works well; not the priority.

---

## Signature: the margin

The one element this interface is remembered by.

**Code posts render as a leaf of a lab record.**

```
┌─┬─────────────────────────────────────────┐
│ │  Lab 4 · Q2 — Linked list      c   ⧉    │   ← margin head
│ ├─────────────────────────────────────────┤
│1│  #include <stdio.h>                     │
│2│                                         │
│3│  int main() {                           │
│4│      printf("hello");                   │
│ │  ⌄ show 22 more lines                   │
└─┴─────────────────────────────────────────┘
  ↑
  2px rule-colored vertical line, full height
```

- A **2px vertical line in `rule`** runs the full height at the left edge.
- **Line numbers** sit in a 40px gutter in Plex Mono at `graphite`, right-aligned.
- The **margin head** carries the code title, the lab tag, the language chip, and the
  copy button.
- Bodies over 15 lines **collapse** with a "show N more lines" control.
- Copy button confirms in place: `⧉ copy` → `✓ copied`, reverting after 1.5s.

**Nothing else in the interface uses a vertical rule.** That exclusivity is the whole
point — scrolling a busy room, code is identifiable in peripheral vision.

Syntax highlighting via Shiki with a custom theme built from our tokens: `ink` for
plain, `pen` for keywords, `rule` for strings, `graphite` for comments, `marigold` for
numbers. Never ship a stock Shiki theme; a Dracula-colored block inside this palette
would break the whole conceit.

---

## Aesthetic risk: fade with age

**Message text desaturates toward `graphite` as its 8-hour expiry approaches.**

| Age | Text color |
|---|---|
| 0–2h | `ink` (full) |
| 2–4h | 85% toward `graphite` |
| 4–6h | 70% |
| 6–8h | 55% — the floor (dark) / **65% — the floor (light)** |

Like pencil fading on paper. The product's central promise becomes visible in the
material rather than needing a countdown widget in every row.

**Constraints:**
- The floor is a **hard contrast floor** — the oldest message must still clear WCAG AA
  (4.5:1) against the page background. *Amended 2026-08-30:* the same opacity cannot do
  that in both themes. `ink` at 55% over light `paper` measures **3.66:1** (fails),
  while `chalk` at 55% over dark `desk` measures **5.14:1** (passes). So the 6–8h step
  is theme-dependent: **0.65 in light (4.99:1)** keeps the designed 0.55 depth in dark,
  where the darker background buys the contrast. Measured, not eyeballed — the ratios
  are pinned in `tests/age.test.ts`.
- **Code bodies never fade.** Someone copying a 6-hour-old answer needs to read it
  perfectly. Only the surrounding chrome and text messages age.
- Recomputed on a 5-minute interval, not per render.

If this reads as "broken" rather than "aging" in practice, it comes out. Keep it
isolated behind one utility so removal is a one-line change.

---

## Motion

Restrained. Four moments only.

| Moment | Animation | Duration |
|---|---|---|
| Message arrives | 8px rise + fade in | 180ms, ease-out |
| Copy confirm | label cross-fade + subtle scale | 150ms |
| Reaction toggle | scale 1 → 1.15 → 1 | 200ms, spring |
| Theme switch | background and text cross-fade | 250ms |

Everything wrapped so `prefers-reduced-motion: reduce` disables it. No scroll-triggered
reveals, no ambient background motion, no page-load orchestration — this is a tool
people use during a lab session, not a landing page.

---

## Component notes

- shadcn primitives are **restyled**, never used with default appearance. If a
  component still looks like stock shadcn after styling, it is not done.
- **At most one Magic UI component**, and only where it clearly earns its place.
  Default to zero.
- Buttons: `pen` filled for primary, hairline outline for secondary, `rule` text for
  destructive. Three variants total.
- **SUDO badge:** 11px Plex Mono, 4px radius, tracking 0.08em. A 2px `marigold` left
  border plus `marigold` @ 12% as the background, with the **label text in `ink`**.
  *Amended 2026-08-05:* this previously read "`marigold` text on `marigold` @ 12%",
  which measures **1.57:1 in light mode** against a 4.5 floor. Marigold survives as a
  border and wash — both UI surfaces, where the floor is 3.0 — so the badge still reads
  as marigold at a glance without failing contrast. The same recipe applies to any
  marigold-on-marigold label, including the pinned strip. No new color was introduced.
- **Empty room:** an invitation, not an apology — "Nothing here yet. Paste your lab
  code and someone will thank you." Set in Figtree at Body, `graphite`.

---

## Voice

- Active voice, sentence case, plain verbs.
- A control names what happens: "Post code", not "Submit".
- The same word all the way through a flow: the button says "Post code", the failure
  says "Code didn't post".
- Errors state what happened and what to do. They do not apologize, and they name real
  numbers: "Code is 20,000 characters max. This is 24,310."
- Never expose implementation vocabulary — no "token", "hash", "RLS", "action". A
  student sees "your name here", "you're posting too fast", "this room is read-only".

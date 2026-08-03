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
| `graphite` | `#6E645C` | timestamps, handles, meta, faded text |

### Dark

| Token | Hex | Job |
|---|---|---|
| `desk` | `#1A1613` | page background |
| `chalk` | `#EDE6DE` | body text, headings |
| `pen` | `#7FB0DC` | as above |
| `rule` | `#D9705F` | as above |
| `marigold` | `#F0B657` | as above |
| `graphite` | `#9A8F86` | as above |

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

**Message text desaturates toward `graphite` as its 24-hour expiry approaches.**

| Age | Text color |
|---|---|
| 0–6h | `ink` (full) |
| 6–12h | 85% toward `graphite` |
| 12–18h | 70% |
| 18–24h | 55% — the floor |

Like pencil fading on paper. The product's central promise becomes visible in the
material rather than needing a countdown widget in every row.

**Constraints:**
- The 55% floor is a **hard contrast floor** — the oldest message must still clear
  WCAG AA against `paper`. Verify with a real contrast check, do not eyeball it.
- **Code bodies never fade.** Someone copying an 18-hour-old answer needs to read it
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
- **SUDO badge:** 11px Plex Mono, `marigold` text on `marigold` @ 12%, 4px radius,
  tracking 0.08em.
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

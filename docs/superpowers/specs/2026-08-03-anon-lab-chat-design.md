# Anonymous Lab Chat — Design Spec

**Date:** 2026-08-03
**Status:** Approved
**Project:** hitchat

## Problem

Lab instructors hand out programming assignments during lab sessions. Students who
finish want to share working code with classmates, but no good channel exists:
WhatsApp mangles code formatting, and putting your name on shared code invites
trouble. Existing chat tools also keep everything forever, which nobody wants for
throwaway lab answers.

## Goal

A web chat where students in a specific department/year/batch/group can anonymously share
labelled, syntax-highlighted lab code and talk about it. Everything self-destructs
after 8 hours. One owner (the project author) administers the whole thing and can
delegate moderation to co-admins.

## Non-goals

- Accounts, profiles, or any persistent user identity
- File uploads, images, or attachments
- Direct messages between students
- Code execution or output checking
- Search across rooms or history export
- Mobile-first optimization (desktop-first; mobile must work, not excel)

## Users

- **Student** — anonymous, no account. Joins a room, reads, chats, posts code, reacts.
- **Co-admin** — holds a secret. Moderates student and co-admin messages in any room,
  but cannot alter an owner SUDO message. Cannot alter structure or admins.
- **Owner** — holds the root secret. Everything a co-admin can do, plus managing
  departments/years/batches/groups and creating/revoking co-admins.

---

## Architecture

### Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16.2.12, App Router | Already scaffolded; Server Actions give a server trust boundary without a separate API |
| Database | Supabase Postgres (free tier) | Free, hosted, Realtime and pg_cron included |
| Supabase client | `@supabase/supabase-js` only | **Not `@supabase/ssr`** — its sole job is syncing Supabase Auth cookies, and we use no Supabase Auth. `@supabase/auth-helpers-nextjs` is deprecated. |
| Live updates | Supabase Realtime | `postgres_changes` + Presence + Broadcast, no polling |
| Scheduled purge | Supabase `pg_cron` | Runs inside the DB; no external cron or always-on host |
| Styling | Tailwind v4 + shadcn primitives | Primitives only, restyled by our own token layer |
| Highlighting | Shiki | Build-time grammars, accurate, no runtime `eval` |
| Motion | Motion (`motion/react`) | Small, respects `prefers-reduced-motion` |
| Hosting | Vercel free tier | Zero-config for Next.js |

### Trust boundary

**Every write goes through a Next.js Server Action** holding the Supabase
service-role key. The browser holds only the publishable key, and RLS grants it
`SELECT` on chat tables and nothing else. No client can insert, update, or delete a
row under any circumstance.

This is load-bearing: rate limiting, ban enforcement, admin authorization, and input
caps are only meaningful if the client cannot bypass them by talking to Postgres
directly.

Reads are the exception by design — clients subscribe to Supabase Realtime directly,
which is why live updates cost us no server infrastructure.

**Clients never receive `author_token_hash`.** It is withheld with a **column-level
grant** — `grant select (id, group_id, kind, body, ...) on messages to anon` — which
excludes the hash while leaving the base table subscribable by Realtime. Verified
against Supabase's WALRUS source: `realtime.apply_rls` calls `has_column_privilege`
per column and omits columns the subscribing role cannot select, so the hash does not
leak through Realtime either. Two constraints follow: the **primary key must stay
granted** (WALRUS returns 401 with no payload otherwise), and `select *` is rejected
for column-restricted roles, so **every client query must name its columns
explicitly**.

Reaction ownership ("did I react?") is resolved by the Server Action echoing back the
viewer's own reactions, never by exposing hashes.

### Deletion is soft

Supabase Realtime **cannot filter DELETE events and does not apply RLS to them** — a
`DELETE` broadcasts to every subscriber in every room, carrying only primary keys. A
bulk purge would therefore spam every connected client with thousands of unusable
events.

So deletion is a soft delete: `messages.deleted_at` is set by an `UPDATE`, which *is*
filterable and RLS-respecting. Clients react to the update by replacing the row with
"message deleted".

Expiry needs no event at all — clients already know each message's `expires_at` and
hide it locally when it passes. The `pg_cron` job then hard-deletes expired rows, by
which point no client is displaying them. **No client ever subscribes to DELETE.**

### Next.js 16 constraints

Verified against `node_modules/next/dist/docs/`. These differ from older Next.js
and must be honored:

- `cookies()`, `headers()`, `params`, `searchParams` are **async**. Synchronous access
  was removed in v16.
- `cookieStore.set()` / `.delete()` are legal **only** in Server Actions and Route
  Handlers, never during Server Component render.
- `middleware.ts` is now **`proxy.ts`**, Node runtime only, and the docs explicitly
  state it is *not* an authorization mechanism. Every admin Server Action
  re-verifies the session cookie server-side. `proxy.ts` is used only for cosmetic
  redirects, if at all.
- Server Actions **dispatch sequentially, one at a time per client**. Never
  `Promise.all` them from the client. Sends use optimistic UI so the queue is
  invisible.
- `revalidateTag` requires a second argument in v16. We mostly avoid it — Realtime
  handles freshness.
- Expected errors are **return values**, not throws, read via `useActionState`.
- Turbopack is the default builder. No custom webpack config.
- `next lint` is removed; lint via `eslint` directly (already configured).
- `cacheComponents` stays **off**. Chat is fully dynamic; we gain nothing and it
  would remove the route segment config we rely on.

---

## Data model

Room identity is the chain department → year → batch → group. `groups` *is* the room.

A year is a first-class table rather than a column on `batches` so the owner can create
an empty year up front and so every level of the tree has the same CRUD shape.

### `departments`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text | "Computer Science" |
| `slug` | text unique | "cse", used in URLs |
| `sort_order` | int | manual ordering |
| `created_at` | timestamptz | |

### `years`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `department_id` | uuid fk → departments, on delete cascade | |
| `number` | int, check 1–5 | 1st, 2nd, 3rd, 4th (5 for integrated courses) |
| unique | (`department_id`, `number`) | |

### `batches`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `year_id` | uuid fk → years, on delete cascade | |
| `number` | int | 1, 2, 3 |
| `label` | text | display override, nullable |
| unique | (`year_id`, `number`) | |

### `groups` — the room
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `batch_id` | uuid fk → batches, on delete cascade | |
| `label` | text | "A", "B" |
| `is_locked` | bool default false | read-only when true |
| unique | (`batch_id`, `label`) | |

### `messages`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `group_id` | uuid fk → groups, on delete cascade | |
| `kind` | text check in (`text`,`code`) | |
| `body` | text | ≤1000 chars for text, ≤20000 for code |
| `code_lang` | text nullable | one of the allowed languages |
| `code_title` | text nullable | ≤80 chars, e.g. "Linked list insert" |
| `lab_tag` | text nullable | ≤24 chars, e.g. "Lab 4" |
| `reply_to_id` | uuid nullable fk → messages, on delete set null | |
| `author_token_hash` | text | sha256(token + pepper) |
| `author_name` | text | derived handle, denormalized |
| `author_color` | text | derived hue, denormalized |
| `admin_id` | uuid nullable fk → admins | non-null ⇒ SUDO badge |
| `is_pinned` | bool default false | |
| `deleted_at` | timestamptz nullable | soft delete; row stays until purged |
| `created_at` | timestamptz default now() | |
| `expires_at` | timestamptz | `created_at + interval '8 hours'` |

Indexes: `(group_id, created_at desc)`, `(expires_at)`, `(group_id, lab_tag)`.

Deleted messages keep their row (so the UPDATE broadcasts) but the Server Action
blanks `body`, `code_lang`, `code_title` and `lab_tag` on delete — the content is gone
from the database immediately, not merely hidden.

### `reactions`
| column | type | notes |
|---|---|---|
| `message_id` | uuid fk → messages, on delete cascade | |
| `author_token_hash` | text | |
| `emoji` | text check in (`works`,`buggy`,`fire`,`eyes`) | |
| `created_at` | timestamptz | |
| pk | (`message_id`, `author_token_hash`, `emoji`) | one vote each |

Reactions are deleted by cascade when their message expires.

### `admins`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `display_name` | text | shown in admin management only |
| `role` | text check in (`owner`,`co_admin`) | |
| `secret_hash` | text | **bcrypt/argon2. Never plaintext.** |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz nullable | soft revoke |

### `admin_sessions`
| column | type | notes |
|---|---|---|
| `token` | text pk | sha256 of a random 32-byte value; the raw value lives only in the cookie |
| `admin_id` | uuid fk → admins, on delete cascade | |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | 3 hours |

### `bans`
| column | type | notes |
|---|---|---|
| `author_token_hash` | text pk | |
| `until` | timestamptz | |
| `reason` | text nullable | |
| `created_by` | uuid fk → admins | |

### `rate_events`
| column | type | notes |
|---|---|---|
| `author_token_hash` | text | |
| `action` | text | `text`, `code`, `reaction` |
| `created_at` | timestamptz | |

Index `(author_token_hash, action, created_at desc)`. Rows older than 5 minutes are
purged by the same cron job.

---

## Anonymous identity

1. On first visit the browser generates a random UUID v4 and stores it in
   `localStorage` under `hitchat:token`.
2. The token is sent with every Server Action call.
3. The server computes `sha256(token + PEPPER)` where `PEPPER` is a server-only env
   var. Only the hash is ever stored.
4. Handle and color are **derived deterministically from the hash** — a compact,
   one-token username made from two short syllables and a 3-digit suffix (for example,
   `NixFox042`), plus a hue. The name palette mixes cool, playful, professional,
   Linux-style, and meme-adjacent terms without using colour words.

Deriving rather than storing means a user cannot claim someone else's handle, and the
database never holds a value that could be replayed as a device identifier.

**Reroll** discards the token and generates a new one — new handle, and past messages
keep their old handle. The in-room control re-checks the current ban before rerolling,
so a banned identity cannot use the normal identity control to return to posting. Clearing
all browser storage can still create a fresh anonymous device, which remains an inherent
trade-off of open access without accounts.

**Collision:** ~1.4M handle combinations. Collisions within a 30-person room are
vanishingly unlikely and harmless if they occur.

---

## Ephemerality

Every message carries `expires_at = created_at + 8 hours`. A `pg_cron` job runs
every 10 minutes:

```sql
select cron.schedule('purge-expired', '*/10 * * * *', $$
  delete from messages where expires_at < now();
  delete from rate_events where created_at < now() - interval '5 minutes';
  delete from admin_sessions where expires_at < now();
  delete from bans where until < now();
$$);
```

Clients hide messages past `expires_at` locally, so the up-to-10-minute lag between
expiry and the row's physical deletion is never visible. This is why the purge needs
no realtime event.

**If `pg_cron` turns out to be unavailable on the free tier** (unverified at design
time), the fallback is a Vercel Cron hitting a Route Handler guarded by a secret
header, running the same SQL. The queries are identical either way, so this is a
deployment detail rather than a design change.

**Pinned messages expire too, with no exception.** The rule is "everything vanishes in
8 hours" with no asterisk, which is what makes it trustworthy and simple to explain.
A standing announcement gets re-pinned.

Reads always filter `expires_at > now()` so the up-to-10-minute lag between expiry and
deletion is never visible.

---

## Features

### Room selection
`/` presents Department → Year → Batch → Group. The last-used room is remembered in
`localStorage` and offered as a one-click resume. Room URL is
`/c/[dept-slug]/[year-number]/[batch-number]/[group-label]` — e.g. `/c/cse/3/2/a`.

### Loading a room
The room page server-renders the **most recent 100 non-expired messages** for instant
first paint, then the client subscribes to Realtime for anything newer. Scrolling to
the top loads the previous 100 by `created_at` cursor. An 8-hour room rarely exceeds a
few hundred messages, so this is the whole pagination story.

### Messaging
- **Text** — ≤1000 chars, plain, consecutive messages by the same author grouped.
- **Code** — separate composer: body, language, optional title, optional lab tag.
  Renders as a lab-record card (see Visual design).
- Allowed languages: `c`, `cpp`, `java`, `python`, `javascript`, `sql`, `bash`,
  `plaintext`. Restricted deliberately to keep the Shiki bundle small.

### Reply-to
Any message can be replied to. The reply shows a single-line quoted preview; clicking
it scrolls to and highlights the original. If the original has expired, the preview
reads "original message expired".

### Reactions
Fixed set of four: `works`, `buggy`, `fire`, `eyes`. One per person per mark, toggleable,
counts shown inline. Fixed set avoids an emoji picker and keeps signal high. The marks
are native emoji (`✅`, `⚠️`, `🔥`, `👀`) with accessible names; the room-facing controls
show the emoji and optional count, while the reaction meaning is not repeated as visible
text. *(Amended 2026-08-30 — the owner requested familiar emoji marks rather than
drawn/text glyphs and visible word labels.)*

### Lab tag filter
The room header shows chips built from `lab_tag` values currently present in the room:
`All · Lab 3 · Lab 4`. Selecting one filters the stream to code posts with that tag.
Purely client-side over loaded messages.

### Live updates
Clients subscribe to two `postgres_changes` events on `messages`, both filtered to the
current room: **INSERT** (new message) and **UPDATE** (soft delete, pin/unpin,
reaction count change). Never DELETE, for the reason given above.

Supabase Realtime auto-rejoins channels but events during a disconnect are lost, so on
every `SUBSCRIBED` status the client refetches the recent window and reconciles by id.
That closes the gap on both first connect and reconnect with one code path.

### Presence and typing
Supabase Presence gives a live "N here" count in the header. Broadcast drives
"someone is typing…" above the composer, throttled to one event per 3 seconds per
client, never naming who. Typing uses Broadcast rather than Presence `track()`
because Supabase's docs warn that high-frequency `track()` floods the channel.

### Pinned messages
Admin-pinned messages collapse into a header strip; clicking expands. Pinned messages
still expire at 8 hours.

### Self-delete
A student may delete their own message within **5 minutes** of posting, matched by
`author_token_hash`. Covers the "wrong code, wrong room" mistake without allowing
history to be rewritten hours later. Enforced server-side.

### Admin
Login at `/sudo` (unlisted). The secret is checked against `admins.secret_hash` with a
constant-time verify; on success an httpOnly, `secure`, `sameSite=lax` session cookie
is set, valid 3 hours.

Admin capabilities in any room:
- Owner: delete or pin / unpin any message. Co-admin: delete or pin / unpin student
  and co-admin messages, never an owner SUDO message.
- Lock room (read-only for students; admins can still post)
- Owner: purge all messages in the room. Co-admin: purge all non-owner messages.
- Ban a student `author_token_hash` for 24 hours (admin posts are never bannable)
- Post with a **SUDO** badge

Admin pages:
- `/sudo/structure` (owner and co-admin) — create, rename, delete departments, years,
  batches, groups. Deleting cascades and is confirmed with a typed room name.

Owner-only pages:
- `/sudo/admins` — create a co-admin (customizable or server-generated secret, shown
  once), revoke a co-admin, see active/revoked status.

The owner is bootstrapped by seeding one `admins` row whose `secret_hash` is derived
from an `OWNER_SECRET` env var at setup time. The env var is not consulted at login —
the DB row is the single source of truth for every admin.

Every admin Server Action independently loads the session, checks `revoked_at is null`
and `expires_at > now()`, and re-checks role for owner-only operations. No trust is
placed in `proxy.ts` or in any client-supplied flag.

---

## Abuse controls

Enforced in a Postgres function called by the Server Action, counting rows in
`rate_events`:

| Action | Limit |
|---|---|
| Text message | 5 per 10 seconds |
| Code post | 10 per 60 seconds |
| Reaction | 30 per 60 seconds |
| Admin login attempt | 5 per 60 seconds per IP |

Input caps: text ≤1000 chars, code ≤20000 chars, title ≤80, lab tag ≤24. Enforced by
both a check constraint and a server-side validation returning a friendly message.

Banned tokens are rejected by every write action with a plain explanation and the ban
expiry time.

Postgres-side counting rather than in-memory is required: serverless invocations do
not share memory, so an in-process counter would not limit anything.

---

## Error handling

Server Actions return a discriminated result rather than throwing:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'rate_limited' | 'banned' | 'locked' | 'invalid' | 'unauthorized' | 'server'; message: string; retryAfter?: number }
```

Client behavior per case:

- **Optimistic send** — the message appears immediately in a pending state. On
  failure it flips to a "didn't send · retry" row rather than vanishing.
- **`rate_limited`** — a quiet inline cooldown next to the composer with a countdown.
  Never a modal.
- **`banned`** — composer replaced by an explanation and expiry time. Reading
  continues.
- **`locked`** — composer replaced by "this room is read-only right now".
- **`invalid`** — inline field message naming the actual limit ("code is 20,000
  characters max, this is 24,310").
- **Realtime disconnect** — a "reconnecting" pill in the header; on reconnect, refetch
  the recent window and reconcile.
- **`unauthorized`** on an admin action — session cleared and redirect to `/sudo`.

Errors state what happened and what to do. They do not apologize and are never vague.

---

## Visual design

Full detail lives in `design.md`. Summary:

**Concept — the lab record file.** The physical artifact of the subject's world:
ruled paper, red margin rule, blue ballpoint. This grounds "warm and soft" in
something specific rather than a generic warm palette.

**Palette** — every color has exactly one job.

| Token | Light | Dark | Job |
|---|---|---|---|
| `paper` / `desk` | `#FAF5F1` | `#1A1613` | background |
| `ink` / `chalk` | `#241E1A` | `#EDE6DE` | body text |
| `pen` | `#2C5F8F` | `#7FB0DC` | primary action, links, focus ring |
| `rule` | `#C8503F` | `#D9705F` | margin rule, destructive |
| `marigold` | `#E5A03A` | `#F0B657` | SUDO badge, pinned strip — nothing else |
| `graphite` | `#6E645C` | `#9A8F86` | timestamps, meta, faded text |

A cool blue carrying the interactive weight against warm paper keeps the interface
from collapsing into a single warm hue.

**Type** — Bricolage Grotesque (display, room titles only, used sparingly), Figtree
(body), IBM Plex Mono (code and data labels). All three from Google Fonts, self-hosted
via `next/font`. No serif, deliberately — serif plus cream is the current generic
default.

**Signature — the margin.** Code cards render as a leaf of a lab record: a hairline
`rule`-colored vertical line at the left, line numbers in the gutter, title and lab
tag set in the margin head. No other element in the UI uses that vertical rule, so
code posts are findable at a glance while scrolling.

**Aesthetic risk — fade with age.** Message text desaturates toward `graphite` as
`expires_at` approaches, like pencil fading. The product's central rule becomes visible
in the material instead of needing a countdown widget. Age-fade never drops contrast
below WCAG AA against `paper` — the floor is enforced, so the oldest message is still
fully readable.

**Motion** — restrained: message arrival (8px rise + fade, 180ms), copy confirm,
reaction pop, theme cross-fade. All disabled under `prefers-reduced-motion`.

**Theme** — light/dark via `next-themes`, defaulting to system, no flash on load.

**Component budget** — shadcn primitives restyled by our token layer, never used with
default styling. At most **one** Magic UI component, and only where it earns its place.

**Quality floor** — responsive to mobile, visible keyboard focus everywhere, reduced
motion respected, code cards keyboard-copyable.

---

## Testing

- **Unit** — handle derivation determinism, age-fade contrast floor, validation caps,
  `ActionResult` shape.
- **Database** — rate-limit function under burst; cascade deletes; the purge job
  removing exactly the expired rows and nothing else.
- **Authorization (critical)** — a co-admin session rejected on every owner-only
  action; a revoked admin rejected; an expired session rejected; a student token
  rejected on every admin action; self-delete rejected past 5 minutes and rejected for
  another author's message.
- **RLS** — assert with the publishable key that `insert`, `update`, and `delete` all
  fail on every table, and that `select author_token_hash from messages` is denied.
  This is the single most important test in the suite; the entire security model rests
  on it.
- **Manual** — two browsers in one room verifying realtime delivery, presence count,
  typing indicator, lock, ban, and purge.

---

## Delivery

Each feature is built on its own git branch and merged when working. Progress is
tracked in `progress.md`; the step-by-step build order lives in `plan.md`. Agent
conventions for this project are recorded in `AGENTS.md`.

## Open risks

- **Free-tier limits.** Supabase free tier allows 200 concurrent Realtime connections.
  Sized for a handful of lab rooms; a college-wide rollout would need re-checking.
- **Ban evasion by clearing browser storage.** Accepted as an inherent trade-off of open
  access without accounts. The in-room reroll control stays locked for an active ban.
- **`localStorage` cleared** ⇒ new identity. Acceptable for an 8-hour-lifetime product.
- **Anyone with the link can join.** Accepted per the open-access decision; content is
  throwaway lab code that self-destructs.

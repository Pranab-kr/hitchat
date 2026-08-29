# Progress

**If you are a new agent: read this file top to bottom before touching anything.**
This is the handoff document. It assumes you have no memory of prior sessions.

Then read `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` (current step +
next), run `git status`, and read only the spec
section for the step you're on. Full protocol in `AGENTS.md`.

---

## Resume here

| | |
|---|---|
| **Phase** | **In progress — audit fixes for the chat message flow on branch `feat/audit-fixes-message-flow`. NOT merged (owner will review).** |
| **Current step** | Apply the `/impeccable audit` findings (P1/P2/P3) to the message flow. |
| **Branch** | `feat/audit-fixes-message-flow` (from `main` @ `3f77f56`; do not merge until the owner says so). |
| **Next action** | Implement the fixes: theme-aware fade floor + contrast test (P1), composer labels + touch targets (P2), ban-dialog semantics + reconnect status + reduced-motion scroll + stream cap + theme cross-fade (P3). |
| **Blocked?** | No. |
| **Last updated** | 2026-08-28 |

**Note:** the previous "Resume here" claimed `feat/code-limit-and-perf` was in progress.
That work is complete and merged (`d91511b`, recorded under Done 2026-08-14). This block
was stale; reconciled against git on 2026-08-28.

**Environment:** `.env.local` is complete — Supabase URL, publishable key,
`SUPABASE_SERVICE_ROLE_KEY`, a generated `IDENTITY_PEPPER`, and a generated
`OWNER_SECRET`. It is gitignored and **verified never committed** (checked by value
against every tracked file and the full history on 2026-08-06 — 0 hits for all three
secrets).

**Secret rotation — do this before any public deploy.** Both were exposed during the
build: the service-role key to a chat transcript on 2026-08-04, and `OWNER_SECRET` to
browser verification harnesses in Tasks 10 and 12.

1. **Service-role key** — Supabase dashboard → Project Settings → API Keys → roll
   `service_role`. Paste the new value into `.env.local` and into the host's env vars.
   Nothing in the code hardcodes it. `IDENTITY_PEPPER` must **not** be rotated:
   changing it re-derives every anonymous handle and orphans every live ban.
2. **Owner secret** — put the NEW value in `.env.local`, then `bun run rotate-owner`.
   It re-hashes the owner row at bcrypt cost 12 and deletes the owner's sessions (a
   leaked secret may already have minted 7-day cookies). It **refuses to run** if
   `OWNER_SECRET` still matches the stored hash, so a no-op cannot masquerade as a
   rotation. `scripts/seed-owner.ts` will not do this — it is idempotent by design.

Login reads the bcrypt hash from the database, never the env var, so the owner rotation
needs no redeploy.

**The Supabase project ref is not a secret** and is deliberately left in this file: it
is part of `NEXT_PUBLIC_SUPABASE_URL`, which ships to every browser. Security rests on
the publishable key being `SELECT`-only, not on the ref being unguessable.

**The GitHub repo (`Pranab-kr/hitchat`) is PUBLIC.** Audited 2026-08-06: no secret value
appears in any tracked file or in history; `.env.local`, `.claude`, `.mcp.json` and
`.agents` are all gitignored and confirmed excluded.

**Supabase project:** `hitchat` / ref `vbbinzmpnszdayrdfsle` (ap-south-1, Postgres
17.6). Use the supabase MCP tools: `apply_migration` for migrations, `execute_sql`
for queries. `pg_cron` 1.6.4 is confirmed available on the free tier.

---

## The loop

One step at a time. Never start step N+1 before step N is merged.

```
1. git checkout main && git pull
2. git checkout -b feat/<step-slug>
3. Update this file → "In progress", commit that FIRST
4. Build
5. Verify it actually runs
6. Update this file → done + deviations + next action
7. Commit, merge to main, delete branch
```

Step 3 before step 4, always. A branch with commits and no recorded intent is
unrecoverable by a fresh agent.

---

## Done

Newest first. Each entry: what shipped, what deviated, what the next agent needs.

### 2026-08-28 — Room-title home link + code-card bottom collapse ✅

**Shipped (merged `c11069d`, pushed to `origin/main`):**
- `app/c/[dept]/[year]/[batch]/[group]/page.tsx` — the `<h1>` room label is now a
  `next/link` to `/` (prefetch, `hover:text-pen`), so the room title doubles as the way
  back to the room picker. The owner first asked for a separate `← home` button; after
  seeing it, they asked to use the room logo/title itself instead, so the standalone
  button was removed before merge.
- `components/chat/code-card.tsx` — long code cards (>15 lines) gained a **second**
  collapse control at the foot of the expanded body. It lives inside the `<details>`, so
  native behavior hides it while collapsed and shows it only when expanded; clicking it
  sets `detailsRef.current.open = false` and `scrollIntoView({ block: 'nearest' })` so
  the shrunk card is pulled back into view. The top summary toggle is unchanged; short
  cards render the body directly as before.

**Verified:** `tsc --noEmit`, `eslint`, `bun run build` all clean; full suite **148/148**.
`node_modules` was missing at session start (restored via `bun install`, matched
`bun.lock`). A single `tests/admin-auth.test.ts` "JWT issued at future" failure appeared
on the first post-install run and passed on immediate re-run — a live-DB/clock-skew flake,
not caused by these presentation-only files.

**Not done:** the owner chose to **skip** the live browser click-through of the bottom
collapse. The behavior is standard native `<details>` DOM manipulation, but it has not
been exercised in a real browser. If it ever misbehaves, that unverified interaction is
the first place to look.


### 2026-08-14 — 50k code paste limit, Shiki caching, stream memoization, and identity reset ✅

**Shipped:**
- Migration `supabase/migrations/0010_code_limit_50k.sql` widening the `body_length` check constraint to 50,000 chars for code posts.
- Updated `lib/validate.ts` to allow up to 50,000 characters with formatted validation messages.
- Updated `app/actions/highlight.ts` and `components/chat/code-composer.tsx` character limits and counters to 50,000.
- In-memory bounded LRU/FIFO highlight caching in `lib/highlight.ts` to eliminate redundant Shiki Oniguruma parsing for large 50KB code blocks.
- Wrapped `MessageRow` in `React.memo` in `components/chat/message-row.tsx` for optimal stream rendering during live Realtime updates.
- Added `components/room/identity-reroll.tsx` button in the room header so students on shared lab computers can generate a fresh anonymous identity.
- Enhanced `clientKey()` in `app/actions/admin.ts` to prioritize trusted proxy IP headers (`cf-connecting-ip`, `x-vercel-ip`, `x-real-ip`).
- Tests: 148/148 passing across 13 test files, ESLint clean, `tsc --noEmit` clean, and Turbopack production build succeeds.

### 2026-08-06 — UI responsiveness, 3-hour sessions, and owner-safe moderation ✅

**Shipped:** Immediate text-send feedback and a normal Send button; optimistic
reaction toggles with rollback; touch-visible reply/reaction/pin/delete/ban controls;
pending states for moderation actions; prefetched owner navigation with loading
skeletons; instant `Opening room…` feedback that preserves real room 404s; compact
one-token handles such as `NixFox042`; 3-hour admin sessions; and migration
`0009_admin_sessions_three_hours.sql` to shorten existing sessions.

**Moderation hierarchy:** Co-admins can moderate student and co-admin messages but
cannot delete, pin/unpin, ban, or purge owner SUDO messages. The Server Actions enforce
this independently of UI visibility. Room-wide co-admin purge excludes owner messages
in the update query. The UI receives owner ids only as a presentation hint. The spec
was updated to make this hierarchy explicit.

**Database:** Supabase MCP applied `0009_admin_sessions_three_hours` to project
`vbbinzmpnszdayrdfsle`; a read-only verification returned
`active_sessions_over_three_hours = 0`.

**Verification:** `tests/moderation.test.ts` 21/21, full suite 147/147, ESLint,
`tsc --noEmit`, `bun run build`, and `git diff --check` all pass. The moderation tests
include owner/co-admin delete, pin/unpin, purge, and ban cases.

**Next agent needs to know:** Keep the owner-message guard in every moderation action;
the client-side `canModerate` prop is not authorization. Do not edit migration 0009.

### 2026-08-06 — Task 12: owner pages, admin posting, badge contrast ✅

**Shipped:** `app/actions/structure.ts`, `app/actions/admins.ts`, `lib/owner-forms.ts`,
`lib/auth/current-admin.ts`, `app/sudo/structure/page.tsx`, `app/sudo/admins/page.tsx`,
`components/admin/owner-shell.tsx`, `components/admin/structure-forms.tsx`,
`components/admin/admins-panel.tsx`, `tests/owner-actions.test.ts`; modified
`app/page.tsx` (real room picker), `app/actions/messages.ts`, `lib/guards.ts`,
`components/chat/composer.tsx`, `message-list.tsx`, `message-row.tsx`, `design.md`,
`tests/moderation.test.ts`. Tests **139/139 across 13 files**, eslint clean,
`tsc --noEmit` clean, `bun run build` succeeds. **No migration** — the schema already
had everything (`admins.revoked_at`, `messages.admin_id`, the four structure tables).

**Both owner decisions from 2026-08-05 are implemented. Do not re-litigate them.**
- **(a) Admins may post in a locked room.** `sendText`/`postCode` read the session and
  set `messages.admin_id`; the lock check is waived only for them.
- **design.md's SUDO badge recipe was amended**, because (a) made the badge reachable
  and the prescribed recipe fails AA. See § Component notes — the amendment is dated
  and explains itself.

**A bug that only a browser could find: `'use server'` files may export ONLY async
functions.** I first put `emptyStructureState` / `emptyAdminsState` (plain objects) in
the action files. Every test passed, `tsc` passed, **and `bun run build` passed** — but
every form on both owner pages returned **HTTP 500** on submit with
*"A 'use server' file can only export async functions, found object."* The module throws
at import time. They now live in **`lib/owner-forms.ts`**; the action files import them.
**Never export a non-function value from a `'use server'` file** — type-only exports are
erased and are fine, runtime values are not. Nothing but a real POST catches this.

**A second browser-only bug: the server exemption worked but the UI made it
unreachable.** `composer.tsx` returned "This room is read-only right now." for *everyone*
when `locked`, so an admin in a locked room had no composer to type into — the whole of
decision (a) was invisible through the interface. `Composer` and `MessageList` now take
`isAdmin`, and `onReply` is gated on `locked && !isAdmin` too. This is the Task 11
lesson again: **a server-side capability with no call site is dead code**, and the tests
could not see it because they call the action directly.

**Verified in a real browser — 33 checks, all passing.** Signed out, both owner pages
redirect to `/sudo`. As owner: department → year → batch → group created through the
real forms; a lowercase `a` **stored as `A`** (the room page looks groups up
uppercased, so a lowercase row would be a room nobody could open); the new room appears
on `/` and opens **HTTP 200**. In a locked room the admin **posts successfully and the
row carries `admin_id`**, the badge renders, and a student in a second context sees no
composer and the read-only notice. Co-admin: secret shown once with the warning, **gone
after reload**, `bcrypt.compare` verifies it against the stored hash and the raw value
is **not** in the hash; the co-admin signs in, is **redirected away from both owner
pages**, and after the owner revokes them their **session rows are deleted (0)** and the
same cookie **no longer authenticates**. The owner has **no revoke control** rendered.
Deleting a department **refuses a wrong confirmation**, quotes the exact required name,
then deletes and **cascades to groups**.

**The badge now measures 11.59:1 light / 14.89:1 dark**, read from composited pixels
(walking the tree multiplying `opacity`, because reading `color` alone ignores it). The
old recipe was 1.57:1 light.

**A separate unauthenticated-HTTP check — 12 checks, all passing.** The tests mock
`next/headers`; this did not. Harvesting the four Server Action ids from the page bundle
and POSTing them **with no cookie** and **with a real co-admin cookie** produced
refusals in every case, and the database was unchanged: 0 departments written, admins
still 1, the injected `hax` slug and `Backdoor`/`CoMade` names absent. Revoking the
owner over raw HTTP **as the owner** also failed — `revoked_at` stayed null.

**Verified by mutation — three guards proven genuinely covered:**
- Deleting `requireOwner()` from `createDepartment` fails exactly the 2 tests covering
  it (`rejects every structure change`, `rejects everything when no session exists`).
- Deleting the owner-revoke check fails 3 tests.
- Deleting the lock exemption fails the 3 new admin-posting tests **and** 5 others;
  making the exemption *unconditional* (ignoring `adminId`) fails exactly the
  student-lock test. **Both directions are covered**, which matters because the
  dangerous mutation here is the permissive one.

**My own test leaked a row, and it is worth knowing why.** `rejects a malformed or
reserved slug` asserted that `UPPER` is refused, but `createDepartment` **lowercases the
slug before validating** (deliberately — the room URL is matched verbatim, so an
uppercase slug would be unreachable). The insert succeeded and left a `Nope`/`upper`
department on the live database. Deleted, and the test rewritten: the malformed list no
longer contains a normalizable value, a **new** test asserts the lowercase-and-trim
behavior, and both now assert **no row was written**. The mutation runs also leaked 2
departments (guard absent = insert succeeds); all were removed and the DB verified back
to 0.

**Deviations from the plan:**
- **`requireOwner` imported from `@/lib/auth/require`, not the plan's
  `@/app/actions/admin`** — that path does not resolve and would put a guard on a public
  HTTP surface. Predicted by Task 10; confirmed.
- **`lib/owner-forms.ts` is not in the plan** — forced by the `'use server'` export rule
  above.
- **Form-action wrappers (`createDepartmentForm` etc.) are not in the plan.** The plan
  says only "renders a form calling the matching action via `useActionState`". Wrappers
  taking `(prevState, FormData)` are what make `<form action={...}>` post natively, which
  is what makes these pages work with JS disabled — the same correction Task 10 made to
  `SudoForm`.
- **`listAdmins` added.** The plan's admins page has no read path, so it could not list
  anyone. It never selects `secret_hash`; a test asserts the response contains neither
  the secret nor that column name.
- **`lib/auth/current-admin.ts` wraps `verifySession` in try/catch.** `cookies()` throws
  outside a request scope. The fallback is `null` — "treat them as a student" — so the
  helper **can only ever remove privilege, never grant it**. This is also why the two
  test files that don't mock `next/headers` did not break, contrary to what progress.md
  predicted.
- **`assertPostable` was removed from `lib/guards.ts`.** Composing ban + lock now needs
  to know whether the poster is an admin, so `app/actions/messages.ts` owns that as
  `assertPostableAs()`. A comment in `guards.ts` records where it went.
- **`createGroup` stores the label uppercase; `createDepartment` lowercases the slug.**
  Both are required for the room URL to resolve, and both are now covered by a test.
- **Reserved slugs** (`c`, `sudo`, `api`, `admin`, …) are refused — the plan allows a
  department slugged `sudo`.
- **Foreign-key violations (`23503`) are reported as `invalid`, not `server`.** A bad
  parent id can never succeed, so "try again" is the wrong instruction.
- **`revokeAdmin` is idempotent** and returns `ok` for an already-revoked admin.
- **Empty departments are hidden from the room picker** (but shown on
  `/sudo/structure`, where they can be acted on). A department with no rooms is noise on
  a picker.
- **21 tests in `tests/owner-actions.test.ts`, not the plan's 5.** The plan's own test
  mocks `@/lib/auth/session`, which tests `requireOwner` against a stub of itself; these
  mock only `next/headers` and use **real session rows**, as Task 10 established.
- **`tests/moderation.test.ts` gained `signOut()`/`postAsStudent()` and 3 new tests.**
  Three of its tests broke *correctly*: they signed in as admin and then posted, so
  their "student" posts now carried `admin_id` — and `banAuthor` refuses to ban an
  admin. The distinction between "acting as admin" and "acting as a student" did not
  exist in that file before this change.

**Next agent needs to know:**
- **`messages.admin_id` is now written on every post** — `null` for students, the admin's
  id otherwise. `MessageRow` renders the SUDO badge from it. It is set from the session
  cookie only; there is deliberately no parameter for it.
- **The lock exemption is for the lock alone.** Admins are still rate limited (5 text /
  60s), still validated, and still blocked by a ban on their own token. A test asserts
  the rate limit still bites an admin.
- **`isAdmin` on `Composer`/`MessageList` is presentation only.** The server derives the
  exemption independently. Do not add a check that trusts the prop.
- **Playwright was installed temporarily and removed again**, as in Tasks 7–11.
  `package.json` and `bun.lock` are clean. Live DB verified back to **1 admin (Owner),
  0 everything else** — including the 8 sessions and 10 rate events the verification
  runs created.
- **Rotate both secrets before this goes public.** The service-role key was pasted into
  a transcript on 2026-08-04, and `OWNER_SECRET` has now been read by browser harnesses
  in Tasks 10 and 12.


### 2026-08-05 — Task 11: moderation ✅
**Shipped:** `app/actions/moderation.ts`, `components/chat/admin-controls.tsx`,
`components/room/pinned-strip.tsx`, `components/room/admin-bar.tsx` (**not in the
plan** — see Deviations), `tests/moderation.test.ts`; modified
`components/chat/message-row.tsx`, `message-list.tsx`, the room page, and
`tests/realtime.test.ts`. Tests 120/120 across 12 files, eslint clean, `tsc --noEmit`
clean, `bun run build` succeeds. No migration in this task.

**Guards imported from `@/lib/auth/require`, as Task 10 requires.** All five actions
call `requireAdmin()` themselves.

**Verified by mutation — all four guards genuinely covered.** Deleting each in turn
fails exactly the tests that cover it: the `admin_id` ban check, `togglePin`'s
`.is('deleted_at', null)`, `requireAdmin` in `adminDeleteMessage` (fails 2 tests), and
`purgeRoom`'s `.is('deleted_at', null)`.

**Verified in two real browser contexts — 16 checks, all passing.** A student window and
an admin window side by side: the student sees no admin bar and no pin button; pinning
reaches the student window in **821ms with no reload**; unpin removes the strip in 414ms;
delete shows "message deleted" in 820ms and **exactly one message was affected**; locking
replaces the composer with "This room is read-only right now." and removes the input
entirely; unlock restores it; ban asks for confirmation and cancel dismisses it.

**The most important check: moderation actions were POSTed with no session cookie over
real HTTP** (not through a mock). Harvesting the Server Action ids from the page bundle
and calling them anonymously produced **exactly 5 `unauthorized` responses** — one per
action — and the database was **unchanged**: same message count, zero delete markers.
The tests mock `next/headers`; this check does not, which is why it is worth keeping.

**A false-positive browser run that deleted two messages from one click.** The first
harness used `locator('[id^="m-"]').first()`, which **re-resolves against a list that
Realtime is mutating** — so after the first delete the "same" locator pointed at a
different row. It reported 15/15 passing while corrupting its own fixture. Rewritten to
capture explicit message ids up front and target `[id="m-<uuid>"]`. **Any future check
on this stream must pin the id before acting, never use `.first()`/`.last()`.** This is
the Task 9/10 selector lesson in a third form.

**Two WCAG AA failures found by measurement, and one of them is not mine.** Composited
colors were read from real rendered pixels (walking the tree to multiply `opacity`,
because reading `color` alone ignores it):
- **My controls inherited `group-hover:opacity-60` → 2.44:1 light / 2.86:1 dark.** Now
  `opacity-100` on hover: **5.33:1 / 5.69:1**.
- **`PINNED` as marigold text measured 1.72:1 light.** Fixed the way Task 10 fixed
  `/sudo` — marigold survives as a 2px left border plus the 8% wash (UI surfaces), and
  the label is `ink`: **12.72:1 light / 14.77:1 dark**. No new color was invented.
- The marigold border itself is **2.06:1 against paper in light mode, below the 3.0 UI
  floor.** Accepted **only because the word "PINNED" in `ink` carries the meaning** — the
  color is not the sole indicator. Stated plainly rather than claimed to pass.

**`tests/realtime.test.ts` was fixed, not weakened — and this task is what exposed it.**
The DELETE listener at line 136 had **no `group_id` filter**, so it caught other files'
teardown cascades; adding `tests/moderation.test.ts` (which seeds and tears down two
rooms) made it fail on the first full run. progress.md predicted this exact failure and
prescribed this exact fix. `expect(deletes).toHaveLength(0)` is untouched — it is what
proves a soft delete never broadcasts as a DELETE. **Four consecutive full-suite runs
pass**, where the flake previously appeared roughly 2-in-13.

**Deviations from the plan:**
- **`components/room/admin-bar.tsx` was added; the plan builds no UI for `toggleLock` or
  `purgeRoom` at all.** Both actions would have been unreachable dead code, yet the
  plan's own Step 6 says to verify locking in the browser. The bar holds the SUDO badge,
  lock/unlock, and a two-step "clear room".
- **`PinnedStrip` is fed from the live message array, not a server prop.** The plan
  renders it from `pinned` but nothing ever computes or passes that. A prop-seeded strip
  could never update, because pin/unpin arrives as a Realtime UPDATE — **this is exactly
  the Task 9 reactions bug** and it would have failed the same way.
- **`PinnedStrip` renders nothing for a pinned code post's body.** The plan prints
  `m.body`, which for a code message is raw source. It shows `code_title ?? 'code'`.
- **Ban confirmation is an in-page prompt, not `window.confirm`.** The plan calls
  `confirm()`, which is unstyleable, and Task 8 established that this app reports
  everything inline. It lifted to `MessageList` so the row keeps one owner of the state.
- **`AdminControls` surfaces failures.** The plan discards every result with `void`, so
  a failed delete or ban looked identical to a success.
- **`togglePin` refuses a deleted message** (`.is('deleted_at', null)`). Pinning a
  soft-deleted row would put a blank line in the strip with no way to unpin it, since
  deleted rows render as "message deleted" and show no controls.
- **`purgeRoom` skips already-expired rows** (`.gt('expires_at', now)`). They are already
  invisible to every reader, so counting them reports a number the admin cannot see.
- **`banAuthor` refuses to ban an admin.** Without it a co-admin can ban the owner's
  browser token for 24 hours by banning any SUDO-badged message.
- **15 tests, not the plan's 2.** The plan's own test could not have run: it mocks
  `verifySession` to return `adminId: 'test-admin'`, which is not a UUID, so
  `bans.created_by` would fail its foreign key. Real session rows are used instead, as
  in `tests/admin-auth.test.ts`.

**Next agent needs to know:**
- **`isAdmin` on the room page is presentation only, never authorization.** It exists to
  show or hide controls; every action re-verifies its own session. Do not add a check
  that trusts it.
- **Groups are not in the Realtime publication — only `messages` are.** Lock/unlock
  therefore does *not* push to other clients; `AdminBar` calls `router.refresh()` and the
  student's composer updates on their next load. If live lock is ever wanted, that needs
  a publication change, not a client fix.
- **`tests/moderation.test.ts` registers every token it posts in `usedTokens`** so
  `afterAll` sweeps bans and rate events even when an assertion fails. Any new test that
  bans or posts must do the same — the Task 10 leak lesson.
- Playwright was installed temporarily and **removed again**, as in Tasks 7–10.
  `package.json` is clean. Live DB verified back to 0 across departments, messages, bans,
  admin_sessions and rate_events.



**Shipped:** `supabase/migrations/0007_admin_login_rate_limit.sql` (**applied live** to
`vbbinzmpnszdayrdfsle`), `lib/auth/session.ts`, `lib/auth/require.ts`,
`app/actions/admin.ts`, `components/admin/sudo-form.tsx`, `app/sudo/page.tsx`,
`scripts/seed-owner.ts`, `tests/admin-auth.test.ts`; modified `lib/guards.ts` and
`tests/helpers/seed-room.ts`. Tests 105/105 across 11 files, eslint clean,
`tsc --noEmit` clean, `bun run build` succeeds (`/sudo` builds as a dynamic route).

**The migration is `0007`, and it is not in the plan at all.** The spec's abuse-control
table (line 394) says *admin login attempt — 5 per 60 seconds per IP*; the plan
implements no login limit, which leaves `adminLogin` an **unauthenticated bcrypt
oracle** — an attacker can drive unlimited cost-12 comparisons on a public endpoint.
0007 widens the `rate_events_action_check` constraint to accept `admin_login` and
recreates `check_rate_limit` with a 5-per-60s branch, keeping the Task 4 advisory lock
and re-running both revokes. Verified live: 5 `true` then 2 `false`; `anon`,
`authenticated` and `public` all report **false** for EXECUTE; an unknown action still
denies. Probe rows deleted.

**The rate-limit key is a peppered hash of the IP, never the IP itself.** `clientKey()`
reads `x-forwarded-for` (first hop) then `x-real-ip`, falls back to `'unknown'`, and
runs it through `hashToken`. `rate_events` therefore holds no PII.

**Verified in a real browser, dev and production builds, JS on and off — 12 checks:**
wrong secret shows exactly "That secret doesn't work." and sets **no cookie**; correct
secret redirects to `/`; the cookie is `httpOnly=true`, `sameSite=Lax`, `path=/`, 64 hex
chars, **7.00 days**, `secure=false` in dev and **`secure=true` in production**;
`document.cookie` cannot see it (reads `""`); `/sudo` while signed in redirects to `/`;
and **with JavaScript disabled the form still logs in** — sets the httpOnly cookie and
redirects. The rate limit was exercised through the real form: attempts 1–5 rejected,
attempt 6 rate-limited, and the DB recorded exactly 5 events across 1 distinct hashed IP.

**Verified by mutation — all five guards genuinely covered.** Deleting each guard in
turn makes exactly the tests that cover it fail: the expiry check, the `revoked_at`
check, the `timingSafeEqual` comparison, `requireAdmin`'s null-session branch, and
`requireOwner`'s role check.

**Two browser assertions that were false positives, and how they were caught.** Both
are the Task 9 selector lesson repeating:
1. `page.textContent('[role=alert]')` returned empty — Next renders
   `<div id="__next-route-announcer__" role="alert">` and the bare selector matched
   **that**, not the error. Now scoped to `#secret-error` and compared exactly.
2. The rate-limit script counted 4 submits out of 6 clicks, because consecutive
   attempts render an *identical* message so `waitFor` returned on the stale render.
   Now synchronised on the actual POST via `page.waitForResponse`.
**Any future assertion on this page must scope to an id and compare exactly.**

**A WCAG AA failure found by measurement, not by eye.** The error text as `rule` at 12px
measured **4.28:1** on the card in light mode, under the 4.5 floor. Fixed without
inventing a color: `rule` moved to a 2px left border plus a 10% wash, with `ink` for the
text — re-measured from actual screenshot pixels at **15.20:1 light / 14.53:1 dark**, and
the border at 4.15:1 / 5.51:1 against the 3.0 UI floor. Every other pairing already
passed (heading 15.69, sub/label 5.50, button 6.18, input 15.20, footnote 5.33 light;
all dark ≥5.11). Focus ring is 2px solid `pen` in both themes. **`marigold` is
deliberately absent from `/sudo`** — nobody is authenticated on that page yet.

**Deviations from the plan:**
- **`requireAdmin`/`requireOwner` live in `lib/auth/require.ts`, not `app/actions/admin.ts`.**
  Every export of a `'use server'` file is a publicly callable HTTP endpoint; a guard
  does not belong on that surface. **Task 11 must import them from `@/lib/auth/require`** —
  the plan's Task 11 code says `@/app/actions/admin` and will not resolve.
- **A login rate limit was added** (migration 0007, above). The plan has none.
- **`SudoForm` uses `useActionState`, not the plan's `useState`/`useTransition`/`router.push`.**
  The plan's form cannot work without JavaScript — `router.push` needs a hydrated client.
  A `useActionState` form with a `action={...}` prop posts natively, which is what makes
  the JS-disabled check above pass.
- **`createSession` error-checks the insert before setting the cookie.** The plan sets
  the cookie unconditionally, so a failed insert would hand the browser a session cookie
  with no matching row — a silent permanent logout loop.
- **`verifySession` compares the token with `timingSafeEqual`**, after a length check.
  A plain `===` on a session token is a timing oracle.
- **`adminLogin` does not `break` on a bcrypt match.** It compares against every active
  admin so the response time does not reveal *which* admin matched, or how many exist.
- **`loginFormAction` calls `redirect()` outside any try/catch.** `redirect()` works by
  throwing to unwind; catching it turns a successful login into a generic error.
- **`lib/guards.ts` widened `assertRateOk`'s action union** to include `'admin_login'`.
  One-line change, required for `tsc` to pass.
- **24 tests, not the plan's 5:** secrets at rest (3), `verifySession` (6), session
  tokens at rest (2), `requireAdmin`/`requireOwner` (5), `adminLogin` (6),
  `adminLogout` (2).

**One unrelated fix: `tests/helpers/seed-room.ts` now error-checks every insert.**
`tests/reactions-action.test.ts` failed once with
`TypeError: Cannot read properties of undefined (reading 'deptId')` — it passed 10/10 in
isolation and the next full run passed 105/105, so it was a transient ap-south-1 blip.
The real problem was that `seedRoom` swallowed insert errors, so a network failure
surfaced as an unrelated TypeError several lines away. Each insert now throws a named
message and `teardownRoom` tolerates a partially-seeded room.

**My own test leaked a row onto the live database, and the fix was proven under
failure.** The revoked-owner test cleaned up inline *after* its assertion, so a failing
assertion skipped cleanup — a stray `Test RO …` owner row was found in `admins`. Fixed
with an `extraAdminIds` array plus `makeTempAdmin()` and an `afterAll` sweep, then
**verified by forcing that test to fail**: it failed and the DB showed 0 leaked admins.
**Any new test that inserts an admin must register its id in `extraAdminIds`.**

**Next agent needs to know:**
- **`scripts/seed-owner.ts` is idempotent and has already been run.** The live `admins`
  table holds exactly one row — `Owner`, role `owner`, bcrypt cost 12. Running it again
  prints "Owner already exists. Nothing to do." The secret is `OWNER_SECRET` in
  `.env.local`.
- **Sessions are keyed by a sha256 of the raw cookie token**; the raw value exists only
  in the cookie. There is no way to recover a session from the DB, by design.
- The six sessions minted by browser verification were **deleted** afterwards. Live DB
  is 1 admin, 0 sessions, 0 `admin_login` rate events.
- Playwright was installed temporarily and **removed again**, as in Tasks 7–9.
  `package.json` is clean.


### 2026-08-05 — Task 9: reactions and reply-to ✅
**Shipped:** `supabase/migrations/0006_reaction_counts.sql` (**applied live** to
`vbbinzmpnszdayrdfsle`), `app/actions/reactions.ts`, `lib/use-reactions.ts`,
`components/chat/reactions.tsx`, `tests/reactions-action.test.ts`; modified
`lib/columns.ts`, `lib/types.ts`, `components/chat/message-row.tsx`,
`message-list.tsx`, `composer.tsx`, `code-composer.tsx`, and the room page.
Tests 81/81, eslint clean, `tsc --noEmit` clean, `bun run build` succeeds.

**The migration is `0006`, not the plan's `0005`.** 0005 is the eight-hour expiry
change and was already applied. Verified live after applying: `anon` and
`authenticated` both hold `SELECT` on `messages.reaction_bump`, and the
`reactions_bump_message` trigger exists on `reactions`.

**All of the plan's step 7 checks were run in two real browser contexts and pass:**
reaction buttons sit at `opacity: 0` at rest and `0.6` on hover; clicking gives
`aria-label="Works, 1"` with `aria-pressed="true"`; **the second window saw the count
appear in 530ms and disappear again in 742ms**, with `aria-pressed="false"` there — it
sees the count without being told it owns it. The seeded reply rendered its quoted
preview, clicking it scrolled to and highlighted the original, and the reply composer
banner posted a real reply and cleared itself.

**The four planned Task 9 corrections were all applied.** Detail below under
Deviations; the short version is that the plan's component seeds from props and never
refetches, so its own "second window sees the count change" step could not have passed.

**Verified by mutation, not just by passing:** deleting the `assertRoomOpen` call and
the `deleted_at` branch from `toggleReaction` makes exactly the two tests that cover
them fail ("refuses a reaction in a locked room", "refuses a reaction on a deleted
message"). Both guards are genuinely covered.

**A passing browser assertion that was actually a false positive, and how it was
caught.** Playwright's `getByRole(name)` matches **substrings**, so a check written as
`getByRole('button', { name: 'Works' })` matches the reacted `Works, 1` label too — the
un-react assertion passed against the still-reacted state. Re-run reading
`aria-label` off the DOM and comparing exactly, it still passes, but the first version
proved nothing. **Any future assertion on these pills must compare the label exactly.**

**Contrast checked numerically for all four pill states**, since the pills introduce
text on a tinted background that did not exist before: active is `pen` on `pen/12`
(5.20:1 light, 6.44:1 dark), idle is `graphite` on `wash` (4.96:1 light, 4.99:1 dark).
All clear AA.

**The four reaction glyphs are in none of the app's bundled fonts** — checked by parsing
every `.woff2` charset under `.next/static/media`. They come from system fallback
(`Adwaita`/`DejaVu` for ✓ and ⚠, `Noto Color Emoji` for 🔥 and 👀). Screenshotted in both
themes at 4× to confirm none render as tofu. This is the U+29C9 lesson from Task 6
applying again, and it is worth re-checking on any machine that ships this.

**Deviations from the plan:**
- **Reaction state lives in `lib/use-reactions.ts`, not in the component.** The bump
  carries no counts, so a component seeded from props can never update. The hook watches
  every visible message's `reaction_bump`, debounces 250ms so a burst costs one fetch,
  and batches the whole stream into one `getReactions` call rather than one per row.
- **`toggleReaction` also checks room lock and `deleted_at`.** A reaction is a write, so
  a locked room must refuse it; and reacting to a soft-deleted message would hang a live
  count on a row whose content is already blanked. The plan checks neither.
- **`getReactions` caps the batch at 100 ids.** It is a public unauthenticated action;
  unbounded input is a free query sink. Same reasoning as Task 8's `renderCode` fix.
- **`toggleReaction` handles a failed DELETE.** The plan checks `error` only on the
  insert branch, so a failed un-react would return a stale count as a success.
- **The reply UI was built, since the plan references `onJumpTo` but never defines it
  and no UI creates a reply.** A `reply` button appears on hover; the target lifts to
  `MessageList`; `Composer`/`CodeComposer` show a banner with the quoted message and pass
  `replyToId`. `Escape` cancels a reply. `sendText`/`postCode` already accepted
  `replyToId` from Task 5 — nothing server-side changed.
- **`Composer` moved inside `MessageList`.** The reply target is chosen in the list and
  consumed by the composer, and the room page is a server component that cannot hold that
  state. The page renders `<MessageList locked={...}>` and no longer renders `<Composer>`.
- **Jump-to highlights for 1600ms** via a `bg-pen/8` class rather than scrolling silently
  — a scroll with no visual confirmation reads as nothing having happened.
- **Seven tests beyond the plan's three:** two people counted separately with `mine`
  correct for a third party, the `reaction_bump` actually moving, locked-room refusal,
  deleted-message refusal, an empty entry for an unreacted message, the empty-list
  short-circuit, and the oversized-list rejection.

**Next agent needs to know:**
- **`reaction_bump` is now in `MESSAGE_COLUMNS`,** so it is in the Realtime payload.
  `tests/realtime.test.ts` asserts the payload keys equal `MESSAGE_COLUMNS` exactly —
  adding a column without granting `select` on it to `anon` will fail that test, which is
  the intended alarm.
- **Nothing calls `getReactions` server-side.** Reactions are fetched after hydration, so
  a JS-less client sees message content but no counts. That is a deliberate trade —
  server-rendering them would need the anon token, which only exists in `localStorage`.
- Playwright was installed temporarily and **removed again**, as in Tasks 7 and 8.
  `package.json` is clean.


### 2026-08-04 — Message lifetime: 24 hours → 8 hours ✅
**Shipped:** `supabase/migrations/0005_eight_hour_expiry.sql` (**applied live** to
`vbbinzmpnszdayrdfsle`); modified `lib/age.ts`, `tests/age.test.ts`, `app/page.tsx`,
`app/layout.tsx`, `design.md`, `progress.md`, `supabase/migrations/0001_schema.sql`
(comment only), the spec, and the implementation plan. Tests 71/71 (see the flaky
realtime note below), eslint clean, `tsc --noEmit` clean, `bun run build` succeeds.

**Owner decisions, locked — do not re-litigate:**
- **The fade curve rescales proportionally**, it does not keep absolute hours. Same
  four bands and the same 0.55 floor: 0–2h full, 2–4h 85%, 4–6h 70%, 6–8h 55%. Had the
  old 6/12/18 thresholds stayed, every message would expire while still at full or
  near-full opacity and the whole fade-with-age idea would be invisible in practice.
- **Admin bans stay at 24 hours.** Ban duration is a moderation decision and is
  deliberately independent of message lifetime — a ban that expires along with the
  messages is barely a ban. The ban lines in the spec and the plan still say 24 hours
  **on purpose**. Do not "make it consistent."

**Verified against the live database, not just in the migration file:** the column
default reads `(now() + '08:00:00'::interval)`, and a **real inserted `messages` row**
came back with `expires_at - created_at = 08:00:00` exactly. Checking the default
string alone would not have proven a row actually gets 8 hours. Probe rows deleted;
all ten tables verified back to 0 afterwards.

**`0001_schema.sql` was NOT rewritten.** It still says `interval '24 hours'` with a
comment pointing at 0005. It is already applied to the live project, so editing it
would make the file lie about what ran. 0005 is the record of the change. The **plan's**
copy of that schema block does say 8 hours, with a note explaining the divergence — a
fresh database should just use 8 directly.

**No backfill, deliberately.** `messages` was empty when 0005 ran (confirmed by count
before applying). Rows written before a default change keep their original
`expires_at` regardless; had there been live rows, shortening them would have been a
separate decision to put to the owner.

**Next agent needs to know:**
- **`tests/realtime.test.ts` is flaky, and it is not this change's fault.** Across ~13
  full-suite runs this session it failed twice and passed the other eleven — including
  a run on stashed, unmodified `main`, which is how it was ruled out as a regression.
  Two distinct failure modes were seen: (a) 12 DELETE events where 0 were expected,
  because the DELETE listener at `tests/realtime.test.ts:136` has **no `group_id`
  filter** and therefore catches other test files' teardown cascades; (b) the file
  erroring during setup, skipping its tests. Both are live-network/cross-file
  isolation races against ap-south-1, not product bugs. **The fix, if it bites again,
  is to add `filter: group_id=eq.${groupId}` to that DELETE listener** — do not weaken
  the `expect(deletes).toHaveLength(0)` assertion, which is what proves soft deletes
  never broadcast as DELETE.
- The 0.55 opacity floor is unchanged and still a hard WCAG AA contrast requirement.
  Rescaling the *timing* does not touch the contrast math.


**Shipped:** `lib/use-anon-token.ts`, `app/actions/highlight.ts`,
`components/chat/composer.tsx`, `components/chat/code-composer.tsx`,
`tests/use-anon-token.test.ts`; modified `components/chat/code-card.tsx`,
`message-row.tsx`, `message-list.tsx`, the room page, `tests/setup.ts`, and
`tests/messages-action.test.ts`. Tests 71/71, eslint clean, `tsc --noEmit` clean,
`bun run build` succeeds. No migration in this task.

**All five of the plan's step 10 checks were run in a real browser and pass:** text
sends and clears the input; a code post renders with the margin rule, line numbers and a
working copy button; the 6th message in 10s shows "You are posting too fast." inline
inside the composer with **zero** dialog elements on the page; 1,001 characters shows
exactly "Messages are 1,000 characters max. This is 1,001."; and a second browser context
saw a message **1,035ms** after it was posted. Seeded room and all rows deleted
afterwards — all eight tables verified back to 0.

**`localStorage` was undefined in every jsdom test, and it is not our bug.** Node 26
predefines an inert `localStorage` getter on `globalThis`. Vitest's `getWindowKeys`
(`node_modules/vitest/dist/chunks/index.DC7d2Pf8.js:242`) drops any key already present
on the global unless it appears in its own `KEYS` list — and `localStorage` does not.
So jsdom's Storage never gets installed. `sessionStorage` works only because Node does
not predefine that one. `tests/setup.ts` now installs a real Storage borrowed from a
throwaway JSDOM. **Any future test touching localStorage depends on this;** do not
"simplify" it to a Map shim, and if a Node or Vitest upgrade makes it redundant, delete
it deliberately rather than leaving both.

**Deviations from the plan — five in Task 8, each one the plan contradicting its own
verification step:**
- **`useAnonToken` uses `useSyncExternalStore`, not `useEffect` + `setToken`.** The
  plan's form is an eslint *error* under `react-hooks/set-state-in-effect` — the third
  time this plan has hit that rule (Tasks 1 and 7 were the others). Minting happens
  inside `subscribe`, which runs post-mount, so the snapshot read stays pure;
  doing it in the render body trips `react-hooks/purity` instead.
- **`CodeCard` was kept, not deleted.** The plan replaces it with an inline card that
  silently drops the `>15 lines` collapse Task 6 built and verified, and reverts
  `rounded-card` to a raw `rounded-[8px]`. It is now a presentational **client**
  component taking pre-rendered HTML. Verified in-browser: a 24-line post still
  collapses behind "⌄ show 24 lines" with `list-style: none`.
- **Code is highlighted on the server for the initial 100 messages.** The plan
  highlights only in an effect, so every server-rendered code message would show an
  empty box until JS ran — Task 7's bug #2 again. Measured with JS disabled: the card
  renders with real syntax-highlighted content. The effect now covers only messages
  arriving over Realtime, which was verified separately.
- **`renderCode` enforces the same bounds as `postCode`.** It is a public,
  unauthenticated Server Action; the plan's version accepts unbounded input and an
  arbitrary language string, which is a free CPU sink.
- **No `maxLength` on the composer inputs.** The plan sets `maxLength={1000}`, which
  silently truncates and makes its own check #4 unreachable. An over-length counter
  appears instead and the server-side message is what rejects the send.

**One unrelated fix:** `tests/messages-action.test.ts` → "stops the sixth message in ten
seconds" was **already failing on `main`** before this task's changes (verified by
stashing). It is six sequential posts, each several round-trips to ap-south-1, against
vitest's 5s default — a latency timeout, not a logic failure. Given a 30s timeout.

**Next agent needs to know:**
- **`CodeCard` no longer highlights anything.** It takes `html` as a prop. Server
  callers pass `highlightCode(...)`; client callers let `MessageRow` fetch via the
  `renderCode` action. A caller that forgets both gets an empty card, not an error.
- **Playwright was installed temporarily and removed again**, as in Task 7.
  `package.json` is clean. `bun add -D playwright && bunx playwright install firefox`
  if you need it. `@types/jsdom` **was** kept — `tests/setup.ts` imports jsdom directly.
- The dev-tools circle overlapping the composer in local screenshots is Next's dev
  indicator, not our UI. It does not ship.

### 2026-08-04 — Task 7: room page, message list, live updates ✅
**Shipped:** `lib/types.ts`, `lib/age.ts`, `lib/author-color.ts`, `lib/use-now.ts`,
`lib/use-realtime-messages.ts`, `components/chat/message-row.tsx`,
`components/chat/message-list.tsx`, `app/c/[dept]/[year]/[batch]/[group]/page.tsx`,
`tests/age.test.ts`, `tests/realtime.test.ts`. Tests 66/66, eslint clean,
`tsc --noEmit` clean, `bun run build` succeeds. No migration in this task.

**The plan's Step 10 acceptance test passes, measured.** Two independent browser contexts
on `/c/cse/3/2/a`; a service-role INSERT appeared in **both windows in 214ms with no
refresh**, and a soft delete (`deleted_at` + blanked body) flipped both to "message
deleted" in **212ms**. Seeded room and all probe rows deleted afterwards — departments,
years, batches, groups, messages, rate_events and bans are all back to 0.

**Three real bugs in the planned code, all found by looking at the running page:**

1. **Author handles failed WCAG AA on every color in dark mode.** `messages.author_color`
   stores the **light** hex, and the plan inlines it as `style={{ color: ... }}` in both
   themes. Measured against the dark background `#1A1613`: **2.22–3.55:1 for all eight**,
   floor is 4.5. Task 3 had already created `--author-1..8` with a dark column for exactly
   this reason and the plan did not use it. New `lib/author-color.ts` owns the palette and
   maps a stored hex to `var(--author-N)`; `lib/identity.ts` re-exports from it so there is
   still one definition. Verified in-browser: handles now resolve to the dark column
   (e.g. `#59CF82`, 5.03–9.50:1).
2. **Every message was invisible without JavaScript, and until hydration with it.**
   `motion.div initial={{opacity:0}}` server-renders `style="opacity:0"`, so SSR'd content
   never becomes visible unless JS runs. Measured with JS disabled: **all four message rows
   computed `opacity: 0`** while the one non-animated row (the deleted-message branch, which
   returns before `motion.div`) rendered fine — that asymmetry is what gave it away.
   `initial` is now gated on `useMounted()` (the Task 1 hook), so the enter animation only
   applies to messages that arrive after hydration. Re-measured with JS off: all rows
   `opacity: 1`, and SSR emits zero `opacity:0` wrappers.
3. **A non-numeric year or batch in the URL was a 500, not a 404.** `Number('abc')` is
   `NaN` and `.eq('number', NaN)` makes PostgREST return 400. The page now `notFound()`s on
   a non-integer segment before querying. Verified: `/c/cse/abc/2/a` → 404,
   `/c/nope/3/2/a` → 404, `/c/cse/3/2/a` → 200.

**Other deviations:**
- **`Date.now()` in the `MessageList` render body is an eslint *error*** under
  `react-hooks/purity` in eslint-config-next 16.2.12 — the same class of problem Task 1 hit.
  Extracted to `lib/use-now.ts`, which also fixes a real behavior gap: a render-time
  snapshot only re-evaluates expiry when something else re-renders, so an expiring message
  would linger until the next unrelated update. It now ticks every 30s.
- **`as Message[]` does not compile.** `MESSAGE_COLUMNS` is a runtime string, so PostgREST
  infers `GenericStringError[]` and TS rejects the direct cast; it needs
  `as unknown as Message[]`. Applies to both the page and the hook.
- **`tests/realtime.test.ts` is new — the plan had no test for the socket at all**, only a
  manual two-window check. Three live tests with the **publishable** key: INSERT is
  delivered and its payload contains **exactly `MESSAGE_COLUMNS` and no
  `author_token_hash`** (column grants apply over the socket, which the plan asserted from
  reading Supabase's source but never verified); a soft delete arrives as **UPDATE with zero
  DELETE events**; and a message in another group is **not** delivered.
- **The cross-group test warms the socket first and asserts it received something.**
  Without that, a dead subscription would pass a "nothing arrived" assertion for entirely
  the wrong reason.
- `refetch()` in the hook is guarded by a `cancelled` flag: on a `groupId` change an
  in-flight response would otherwise overwrite the new room's messages.
- `MessageRow` renders the timestamp in a `<time dateTime>` element and adds
  `whitespace-pre-wrap break-words`; without the latter a pasted 1000-char unbroken string
  overflows the column.
- The empty-state early return was folded into the main return so the "Reconnecting…"
  banner still shows in an empty room. In the plan's version it could not.

**Next agent needs to know:**
- **A cold Supabase Realtime tenant drops the first INSERT.** The tenant creates its
  replication slot *after* the client sees `SUBSCRIBED` — confirmed in the project's
  realtime logs, where slot creation is timestamped mid-test-run. The first run of
  `tests/realtime.test.ts` failed for this reason and every warm run passed, so the test
  now sends an explicit warm-up message before asserting. The **app** tolerates this because
  the hook refetches on every `SUBSCRIBED`; don't remove that refetch.
- **Code messages still render as plain text.** That is where Task 7 is supposed to stop.
  Task 8 fetches highlighted HTML through a Server Action and replaces `CodeCard` with an
  inline client card.
- **Never render a stored `author_color` inline.** Always go through
  `authorColorVar()` from `lib/author-color.ts`, or dark mode silently fails contrast.
- Playwright was installed temporarily to check the post-hydration DOM and **removed
  again**; `package.json` is unchanged. `bunx playwright install firefox` if you need it —
  the system Firefox's one-shot `--screenshot` fires before hydration and will show you a
  blank page.

### 2026-08-04 — Task 6: Shiki code rendering ✅
**Shipped:** `lib/shiki-theme.ts`, `lib/highlight.ts`, `components/chat/copy-button.tsx`,
`components/chat/code-card.tsx`, `tests/highlight.test.ts`. Tests 57/57, eslint clean,
`tsc --noEmit` clean, `bun run build` succeeds. No migration in this task.

**The Oniguruma wasm import builds fine under Turbopack.** The plan's contingency
(`serverExternalPackages: ['shiki']` in `next.config.ts`) was **not** needed and was not
added. Verified with `CodeCard` actually imported by a route — an unimported server
component never gets bundled, so building without a call site proves nothing.

**Verified in a real browser, not just by build success.** A temporary `app/probe/page.tsx`
rendered three cards (short C, 22-line C, hostile plaintext) plus a `.dark`-scoped copy,
screenshotted headless Firefox, and was deleted afterwards. The rule runs full height,
line numbers land in the gutter, the long card collapses, and the dark card recolors
syntax from the same HTML — proving the `.dark` class drives it rather than a media query.

**Verified by mutation:** replacing the `safeLang` fallback in `lib/highlight.ts` with a
bare `const safeLang = lang` makes the unknown-language test fail with a real
`ShikiError`. The guard is genuinely covered, not incidentally passing.

**Deviations from the plan, all three found by looking at the rendered page:**
- **The plan's XSS assertion was wrong about the entity.** It expected `&lt;script&gt;`;
  Shiki 4 emits the hex form `&#x3C;script>`. The test as written **failed against
  correct, safe output**. It now asserts the property — no raw `<` survives in the text
  content, and no `<script`/`<img` anywhere — plus one spelling check, and the input
  covers `&` and an `onerror` attribute as well.
- **`<details>` is now rendered only when the body is long.** The plan always emits
  `<details>` and makes `<summary>` conditional, but a `<details>` with no `<summary>`
  child gets the browser's **default "▼ Details" marker** — visible on every short card
  in the screenshot. Short cards render the body directly.
  `[&::-webkit-details-marker]:hidden` covers Safari on the long card.
- **The copy button's `⧉` (U+29C9) is an inline SVG, not the character.** design.md
  prescribes `⧉ copy`, and it rendered as **tofu**. Measured: U+29C9 is in **0 of the 30
  bundled font files** and **no monospace family** on this system (`fc-list` finds 5
  fonts total). The SVG is the same two-overlapping-squares mark with no font dependency.
  `✓` (285 fonts), `⌄` and `⌃` (210+) are fine and were left as characters.
- **`CopyButton` wraps `navigator.clipboard.writeText` in try/catch.** It rejects in an
  insecure context or on a denied permission, and the plan's version would flip the label
  to "✓ copied" after an unhandled rejection — claiming a copy that never happened.
- Used the `rounded-card` token instead of the plan's arbitrary `rounded-[8px]`; they are
  the same 8px, but the token already exists in `globals.css`.

**Next agent needs to know:** `CodeCard` is a **server** component and Task 8 replaces it
with an inline client-side card — that is deliberate, per the plan, not an oversight. Also:
before adding any new glyph to the UI, check `fc-list :charset=<hex>` first. Three of the
characters in design.md's mockups are essentially unavailable in monospace on Linux.

### 2026-08-04 — Task 5: message Server Actions ✅
**Shipped:** `lib/guards.ts`, `app/actions/messages.ts`, `tests/helpers/seed-room.ts`,
`tests/messages-action.test.ts`. Tests 53/53, eslint clean, `tsc --noEmit` clean,
`bun run build` succeeds. No migration in this task.

**Verified by mutation, not just by passing:**
- Replacing the ownership check in `deleteOwnMessage` with `if (false)` makes
  "refuses to delete another person's message" fail. The guard is really covered.
- Moving `assertRateOk` *above* `validateText` makes the quota test fail. **The guard
  ordering is genuinely enforced by the suite**, which was the point of writing it.
- Live DB after teardown: 0 departments, 0 groups, 0 messages, 0 bans. The cascade
  from `departments` works. Orphaned `rate_events` cleared manually.

**`vitest.config.ts` now loads ALL of `.env.local`, not just `NEXT_PUBLIC_`.** Task 2
deliberately withheld `SUPABASE_SERVICE_ROLE_KEY` and `IDENTITY_PEPPER` and asked that
any widening be conscious — this is that moment, because Task 5's tests execute real
Server Actions. Consequence to keep in mind: **the test suite now runs with full
service-role privileges against the live database.** A careless test can delete real
data. `tests/helpers/seed-room.ts` exists so tests operate on a disposable room.

**Deviations from the plan:**
- **The plan's quota assertion was a false positive.** It counted `rate_events` rows
  for the literal hash `'never-recorded'` — a hash that never posts — so it returned 0
  whether or not the quota was consumed. It now counts the *actual* user's rows, which
  is what makes the mutation test above fail correctly.
- **Test tokens are suffixed with a per-run id** (`tok()` helper). Rate-limit state
  lives in the database and outlives the process, so fixed strings like `'code-token'`
  exhausted their own 3-per-60s quota when the suite ran twice inside a window. This
  was a **real intermittent failure** — two runs in a row failed on unrelated-looking
  assertions (`stores the language and title`, `is idempotent…`) before diagnosis.
  Six consecutive full runs pass now. Any future test that posts must use `tok()`.
- **Seven tests added beyond the plan's six:** peppered-hash-not-raw-token, nonexistent
  room, banned user, the 6th-message-in-10s limit, code language/title storage,
  rejected language, refused-delete-leaves-message-intact, and delete idempotency.

**Next agent needs to know:** the earlier "flaky RLS test" noted after Task 4 was
almost certainly this same shared-rate-limit-state problem, not the network. If a
DB-touching test fails intermittently, suspect leftover `rate_events` before anything
else.

### 2026-08-04 — Task 4: validation and rate limiting ✅


**Shipped:** `lib/validate.ts`, `supabase/migrations/0004_rate_limit.sql`,
`tests/validate.test.ts`. The migration is **applied to the live project**
`vbbinzmpnszdayrdfsle` under that name. Tests 40/40, eslint clean, `tsc --noEmit`
clean, `bun run build` succeeds.

**Verified, not just written:**
- `check_rate_limit('test-hash-abc','text')` × 7 → 5 `true` then 2 `false`. The `code`
  action → 3 `true` then `false`. An unknown action returns `false` (deny by default).
- `has_function_privilege` reports **false** for `anon`, `authenticated`, and `public`.
  The function is service-role only.
- **The advisory lock is load-bearing, and this was proven rather than assumed.** A
  temporary lock-free copy of the function allowed **8 of 12** concurrent calls against
  a limit of 5; the real function allows exactly 5. The copy was dropped afterwards.
- All probe rows deleted; `rate_events` is empty.

**Deviations from the plan, both security fixes:**
- **Added `perform pg_advisory_xact_lock(...)`.** The plan's version reads the count
  and inserts as two separate statements, so parallel Server Actions can both read
  `count = 4` and both insert. Measured above: 8 through a limit of 5. Serverless makes
  this the normal case, not an edge case.
- **Added `revoke all ... from public`.** Postgres grants `EXECUTE` on new functions to
  `PUBLIC` by default, and the plan only revokes from `anon`/`authenticated` — which
  leaves the inherited `PUBLIC` grant intact and the function callable with the
  publishable key. Revoking `PUBLIC` first is what actually closes it.
- **Three tests added beyond the plan's twelve:** every allowed language accepted, the
  exact boundary lengths (20000/80/24) accepted, and an empty language rejected rather
  than passed through to the DB check constraint.

**Next agent needs to know:** `check_rate_limit` both checks *and* records, so calling
it twice for one user action consumes two slots. Call it exactly once per attempt, from
the Server Action, before doing the work.

### 2026-08-04 — Task 3: anonymous identity ✅


**Shipped:** `lib/identity.ts`, `lib/supabase/admin.ts`, `lib/supabase/browser.ts`,
`lib/result.ts`, `tests/identity.test.ts`, an **Author colors** section in `design.md`,
`--author-1..8` in `app/globals.css`, and the `server-only` dependency. Tests 26/26,
eslint clean, `tsc --noEmit` clean, `bun run build` succeeds.

**Verified, not just written:**
- The `server-only` guard genuinely fires: a throwaway `'use client'` page importing
  `lib/identity.ts` fails the build with "This API is only available in Server
  Components". The probe route was deleted after the check. The service-role key
  cannot reach the browser by accident.
- All 8 author colors clear WCAG AA on their own background (worst: jade 4.68:1),
  sit >=20 deltaE from `pen`/`rule`/`marigold`/`graphite` in **both** themes, and are
  >=19.4 deltaE apart from each other. Checked numerically, not by eye.

**Deviations from the plan, all deliberate:**
- **The plan's 8 author colors were replaced.** Five of them (`#3F7F6B`, `#7A5C9E`,
  `#B0623A`, `#4A7BA7`, `#8F5A5A`) exist nowhere in `design.md`, and `AGENTS.md`
  forbids inventing colors. The other three were `pen`, `rule`, and `marigold` — all
  reserved, and a **marigold handle would read as a SUDO admin**. Owner approved a
  purpose-built palette instead; it is now `design.md` § Author colors, which is the
  source of truth. `AUTHOR_COLORS` in `lib/identity.ts` mirrors the light column.
- **`design.md` line 38 changed:** `graphite` no longer lists "handles" as its job.
- **The plan's `ADJECTIVES` list was replaced.** It was color words (`Teal`, `Amber`,
  `Cobalt`, `Rust`…), but name and color derive from *different* hash slices, so
  "Amber Otter" would render violet. Now texture/quality words. A test enforces this.
- **`vitest.config.ts` aliases `server-only` to its own `empty.js`.** That package's
  main entry is a bare `throw`; Next resolves the empty `react-server` condition when
  bundling for the server, but vitest sets no such condition, so every server module
  would throw on import. The alias reproduces server resolution **in tests only** —
  the real build guard is untouched, as the probe above confirms.
- **Four tests added beyond the plan's eight:** pepper-changes-hash, throws-without-
  pepper, palette-membership over 500 users, no-color-word-adjectives, and full-palette
  spread. The palette ones are what stop a future edit from silently reintroducing a
  marigold handle.

**Next agent needs to know:** author colors come from `design.md` § Author colors and
nowhere else. Adding or changing one requires redoing the contrast **and** the deltaE
separation check against the reserved tokens in both themes — a swatch that merely
"looks fine" can still read as a link or an admin badge.

### 2026-08-04 — Task 2: database schema + RLS ✅


**Shipped:** `supabase/migrations/0001_schema.sql`, `0002_grants_rls.sql`,
`0003_realtime_cron.sql`, `lib/columns.ts`, `tests/rls.test.ts`. All three migrations
are **applied to the live project** `vbbinzmpnszdayrdfsle` via the supabase MCP
`apply_migration` tool, under those exact names. Ten tables exist, RLS enabled on all
ten. Tests 12/12 (8 new RLS + 4 from Task 1), eslint clean, `tsc --noEmit` clean.

**Verified, not just written:**
- `information_schema.column_privileges` shows `anon` has SELECT on 15 `messages`
  columns and **not** `author_token_hash`; on `reactions` only `message_id, emoji,
  created_at`. `admins`, `admin_sessions`, `bans`, `rate_events` have **no** grants.
- A `set local role anon` probe in the DB confirmed: reading `author_token_hash`,
  inserting a message, and reading `admins`/`bans` all raise `insufficient_privilege`,
  while `select id, body, created_at from messages` succeeds.
- Inserted one live + one expired message and confirmed `anon` sees exactly one — the
  `expires_at > now()` policy works. Probe rows deleted.
- `pg_cron` applied cleanly. `cron.job` has `purge-expired`, `*/10 * * * *`, active.
  **No Vercel Cron fallback needed.**
- `pg_publication_tables` shows `supabase_realtime` publishes `messages` only.

**Deviations from the plan, both mechanical:**
- **`vitest.config.ts` gained `env: loadEnv('test', process.cwd(), 'NEXT_PUBLIC_')`**
  (a Task 1 file). Vitest does not read `.env.local` into `process.env` on its own, so
  the RLS test had no Supabase URL or key and every assertion would have passed for the
  wrong reason. Only the `NEXT_PUBLIC_` prefix is loaded **on purpose** —
  `SUPABASE_SERVICE_ROLE_KEY`, `IDENTITY_PEPPER`, and `OWNER_SECRET` are deliberately
  withheld from the test environment. A later task that needs a service-role test client
  must widen this consciously, not by accident. **(Superseded in Task 5: the widening
  happened there, deliberately. All of `.env.local` now loads into tests.)**
- **`tests/rls.test.ts` carries `// @vitest-environment node`.** It is a live network
  test; the project default is jsdom and there is no DOM involved.

**Security advisor (`get_advisors`, type `security`):** four findings, all `INFO`,
all `rls_enabled_no_policy` on `admins`, `admin_sessions`, `bans`, `rate_events`.
**That is the intended design** — RLS on with zero policies is the deny-everything
state for those tables; only the service role touches them. Do not "fix" this by
adding policies.

**Next agent needs to know:** never add `author_token_hash` to `lib/columns.ts`, and
never `select *` from `messages` or `reactions` with the publishable key — a
column-restricted role is rejected outright. Use `MESSAGE_COLUMNS` / `ROOM_COLUMNS`.

**Caught at review, fixed before merge:** the write-denial tests in `tests/rls.test.ts`
scoped their update and delete with `.neq(id, <zero-uuid>)`, which matches **every row
in the table**. The tests passed only because the grant is missing. If a future
migration ever regressed that grant, running the suite would have blanked or deleted
the entire live `messages` table before the assertion failed. Both now use `.eq()`
against a non-existent id: the permission error still fires, and the failure mode is
harmless. **Any future write-denial test must be scoped this way** — never assert
"this write is refused" with a filter that would match real rows if it isn't.

**Also corrected at review:** this file previously claimed Task 2 was committed on
`feat/db-schema-rls`. It was not — all five files were still uncommitted in the working
tree while the migrations were already live on the remote database. The DB was ahead of
git. Verified against the live project before merging: column grants, RLS/policy counts,
the `purge-expired` cron job, and the realtime publication all match what the migration
files say.

### 2026-08-04 — Task 1: design tokens, fonts, theming ✅
**Shipped:** Tailwind v4 CSS-first token layer (`app/globals.css`), the three Google
fonts via `next/font`, `next-themes` provider, hydration-safe theme toggle, Vitest
setup. Merged to `main` as `249e041`. Tests 4/4, eslint clean, build succeeds.

**Deviations from the plan, all deliberate:**
- **`useSyncExternalStore` instead of `useEffect(() => setMounted(true), [])`.** The
  plan's version is an ESLint *error* under `react-hooks/set-state-in-effect` in
  eslint-config-next 16.2.12. Extracted to `lib/use-mounted.ts` — **use that hook** for
  any client component that must render a different value after hydration. Do not
  reintroduce the useEffect form.
- **`app/page.tsx` was modified** though not in the plan's file list: the Next.js
  scaffold hardcoded `bg-zinc-50 dark:bg-black` and referenced deleted tokens, which
  painted over the new background. Stripped to a placeholder; Task 12 replaces it.
- **`.gitignore` gained `!.env.local.example`** — `.env*` was excluding the template.
- **No separate `--desk`/`--chalk` variables.** design.md's dark tokens are the dark
  *values* of `--paper`/`--ink`, overridden in `.dark`. A comment in `globals.css`
  records this so the naming intent is not lost.

**Not verified:** the browser check (paper `#FAF5F1` → `#1A1613`, no flash of wrong
theme on reload). FOUC is a timing property and cannot be proven statically. Worth a
manual `bun run dev` at some point.

**Open Minor item for the final review:** `app/page.tsx` uses arbitrary type values
(`text-[32px] tracking-[-0.02em]`) because no display type-scale token exists yet. If
one is added later, that is the call site to update.

### 2026-08-04 — Implementation plan written
**Shipped:** `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` — 12 tasks,
each with exact file paths, failing test first, complete code, and a verification step.

**Two design changes came out of verifying library APIs against live docs:**
- **Deletion is now soft.** Supabase Realtime cannot filter DELETE events and does not
  apply RLS to them, so the bulk expiry purge would have broadcast thousands of bare
  primary keys to every client in every room. Deletion sets `deleted_at` via UPDATE
  (filterable, RLS-respecting) and blanks the body. **Never subscribe to DELETE.**
- **`@supabase/ssr` is not used.** Its only job is syncing Supabase Auth cookies and
  this app has no Supabase Auth. Plain `@supabase/supabase-js`.

**Also confirmed:** column-level grants *do* apply to Realtime payloads (verified in
Supabase's WALRUS source), so `author_token_hash` will not leak — but the primary key
must stay granted or Realtime returns 401 with no payload, and `select *` is rejected
for column-restricted roles, so every client query names its columns.

**Unverified, needs checking during Task 2:** ~~whether `pg_cron` is available on the
Supabase free tier~~ — **resolved 2026-08-04: `pg_cron` 1.6.4 IS available** on the
free tier of project `hitchat` (`vbbinzmpnszdayrdfsle`, ap-south-1, Postgres 17.6).
No Vercel Cron fallback needed.

**Supabase project:** `hitchat` / ref `vbbinzmpnszdayrdfsle`. Use the supabase MCP
tools for migrations (`apply_migration`) and queries (`execute_sql`).

**Rejected:** the Supabase quickstart's `@supabase/ssr` + `utils/supabase/middleware.ts`
setup. That scaffolding exists solely to refresh Supabase Auth session cookies, and
this app uses no Supabase Auth — identity is our own anonymous token, admin is our own
signed cookie. `middleware.ts` also does not exist in Next 16 (it is `proxy.ts`).

### 2026-08-03 — Design spec approved
**Shipped:** `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md`, `design.md`,
`AGENTS.md` conventions, this file.

**Decisions locked (do not re-litigate):**
- Open access, no login. Anonymous handles derived from a hashed browser token.
- Writes go through Next.js Server Actions; the publishable key has `SELECT` only.
- Reads via Supabase Realtime. `pg_cron` purges every 10 min.
- Owner + co-admin, secrets hashed in DB. Badge reads **SUDO**.
- 24h expiry with **no exceptions** — pinned messages expire too.
  **(Superseded 2026-08-04: the lifetime is now 8h. The "no exceptions" part still
  holds — pinned messages expire at 8h too.)**
- Students may delete their own message within 5 minutes.
- Visual concept: lab record file. Code card with margin rule is the signature.
  Messages fade as they age (isolated behind one utility; removable in one line).

**Accepted trade-offs:** ban evasion by token reroll is possible; anyone with the link
can join. Both follow from open access and are intentional.

**Next agent needs to know:** the entire security model rests on the publishable key
being `SELECT`-only, and on `author_token_hash` being withheld from clients by
column-level grant. Test that before trusting anything else.

---

## In progress

*Nothing. The room-title home link and code-card bottom-collapse work is merged to
`main` and pushed (`c11069d`, 2026-08-28).*

---

### Standing notes — read before any task

**A `'use server'` file may export ONLY async functions.** Exporting a plain object or
constant from one makes the module throw at import time and every form on the page
returns HTTP 500 — while `bun run test`, `tsc --noEmit` **and `bun run build` all pass**.
Shared form-state constants live in `lib/owner-forms.ts` for exactly this reason.
Type-only exports are erased at compile time and are safe; runtime values are not.

**A server-side capability with no reachable call site is dead code.** Task 11 shipped
`toggleLock`/`purgeRoom` with no UI; Task 12's admin locked-room exemption worked
server-side while `composer.tsx` still hid the composer from admins, making it
unreachable. Tests that call an action directly cannot see this. **After adding a
capability, drive it from the UI in a browser.**

**Never target a message row with `.first()` or `.last()` in a browser check.** Those
locators re-resolve against a list Realtime is actively mutating, so an action can land
on a different row than the one you inspected. A Task 11 harness reported 15/15 passing
while deleting two messages from one click. Capture the id first, then target
`[id="m-<uuid>"]`.

**Moderation UI visibility is not authorization.** `isAdmin` on the room page, and on
`Composer`/`MessageList`, only shows or hides controls. Every action in
`app/actions/moderation.ts` calls `requireAdmin()` itself, every action in
`structure.ts`/`admins.ts` calls `requireOwner()`, and `sendText`/`postCode` derive the
locked-room exemption from the session cookie — never from the prop. Those server-side
checks are the only thing standing between a student and a purge.

**Admins may post in a locked room, and their messages carry `admin_id`.** Decided by
the owner on 2026-08-05 and implemented in Task 12; the spec always said so. The
exemption covers the **lock check only** — an admin is still rate limited, still
validated, and still blocked by a ban on their own token. `banAuthor` refuses to ban an
admin, so a test that wants a bannable message must post it **without** a session
(`postAsStudent` in `tests/moderation.test.ts`).

**Only `messages` is in the Realtime publication.** `groups` is not, so a lock/unlock does
not reach other clients on its own — `AdminBar` uses `router.refresh()`. Anything that
needs a live non-message change requires a publication change, not a client-side fix.

**Import `requireAdmin`/`requireOwner` from `@/lib/auth/require`, never from
`@/app/actions/admin`.** Guards must not be exported from a `'use server'` file — every
export there is a callable HTTP endpoint. The plan's Task 11 code gets this wrong.

**Every admin action re-verifies its own session.** `proxy.ts` is not authorization; the
Next.js docs say so explicitly. A new admin action that trusts an upstream check is a
hole.

**Messages live 8 hours, not 24.** The fade curve in `lib/age.ts` is expressed in
absolute hours and must move with it if that ever changes again. **Admin bans are still
24 hours on purpose**, as is the already-applied `0001_schema.sql`.

**The Task 9 corrections in Deviations were applied.** They are recorded there as history;
nothing is outstanding.

**Reaction counts never arrive over Realtime — only the fact that they changed.**
`reaction_bump` is a timestamp. `lib/use-reactions.ts` is what turns a bump into counts.
Any new surface showing reactions must go through that hook, not read the message row.

**`Composer` is rendered by `MessageList`, not by the room page.** The reply target is
chosen in the list and consumed by the composer. A page that renders `<Composer>` directly
gets a composer that can never reply.

**Never render a stored `author_color` inline.** It is the light-theme hex; all eight fail
WCAG AA on the dark background. Use `authorColorVar()` from `lib/author-color.ts`.

**Anything animating in on mount must gate `initial` on `useMounted()`.** A bare
`motion.div initial={{opacity:0}}` server-renders `opacity:0` and stays invisible if JS
never runs.

**Check `fc-list :charset=<hex>` before shipping any new glyph.** design.md's mockups use
several characters that are missing from every bundled font and from monospace on Linux —
U+29C9 `⧉` was one, and it shipped as tofu until a screenshot caught it.


**`CodeCard` takes pre-rendered `html`; it does not highlight.** Server callers pass
`highlightCode(...)`, client callers go through the `renderCode` action. Forgetting both
gives an empty card with no error.

**`tests/setup.ts` installs `localStorage` by hand** because Node 26 + vitest leave it
undefined in jsdom. Every localStorage-touching test depends on it.

**Guard order is load-bearing: ban → lock → validate → rate limit.** The rate check
*records* an event, so a message rejected for length must not consume the user's quota.
A test enforces this; do not reorder them.

**Tests run with the service-role key against the live database.** Any new test that
posts must suffix its token with the per-run id (`tok()` in
`tests/messages-action.test.ts`), or it will exhaust its own rate-limit quota on the
second run inside a window. Any new test that inserts an **admin** must register its id
in `extraAdminIds` (`tests/admin-auth.test.ts`) so an `afterAll` sweep cleans it up even
when an assertion fails — cleaning up inline after the assertion leaks rows onto the
live database.

**The RLS test is the most important test in the whole suite.** If any assertion in
`tests/rls.test.ts` fails, fix the migration — do not weaken the test.

**The `tests/realtime.test.ts` DELETE-listener flake is fixed** (Task 11): the listener
now filters on `group_id`, so it no longer catches other files' teardown cascades.
`expect(deletes).toHaveLength(0)` is deliberately untouched — that assertion is the
whole point of the test. If it ever fails again, the cause is a real DELETE broadcast.

**Measure contrast on composited pixels, not on the `color` value.** A control inside
`opacity-60` measures nothing like its declared color — Task 11's admin buttons read
2.44:1 while declaring the same `graphite` that passes at 5.33:1 elsewhere. Walk the
tree multiplying `opacity` and blend onto the real backdrop.

**Schema note:** the room hierarchy is four levels — department → **year** → batch →
group. See the Deviations section.

---

## Blocked

*Nothing.*

Both items that lived here through Task 11 — the locked-room admin-posting conflict and
the `design.md` SUDO badge contrast failure — **were decided by the owner on 2026-08-05**
and are now Steps 6 and 7 of Task 12. The decisions and their reasoning are recorded
under **In progress → Owner decisions**. They are settled; do not reopen them.

---

## Deviations from plan

Anything built differently from the implementation plan, and why. Silence about a known
deviation is
how the next agent undoes your work.

### 2026-08-06 — Task 12 resolved both open owner decisions, and needed a new module

The plan's Task 12 is only the owner pages. Two extra pieces of work landed with it
because the owner decided the items that had sat under **Blocked** since Task 11:

1. **Admins may post in a locked room** (spec line 363, never implemented). Cost:
   `lib/auth/current-admin.ts`, `assertPostableAs()` in `app/actions/messages.ts`, the
   removal of `assertPostable` from `lib/guards.ts`, an `isAdmin` prop on
   `Composer`/`MessageList`, and 3 new tests plus a `signOut()`/`postAsStudent()` split
   in `tests/moderation.test.ts`.
2. **`design.md` § Component notes was amended** — the prescribed SUDO badge recipe
   measures 1.57:1 in light mode. It now prescribes the border-plus-wash form Tasks 10
   and 11 had already been forced to invent locally. `design.md` is prescriptive, so this
   was an amendment with a dated note, not a silent override.

**`lib/owner-forms.ts` exists because a `'use server'` file may export only async
functions.** The form-state constants started out in the action files, which built and
tested clean but 500'd every form on submit. This is now a standing note.

**Form-action wrappers are not in the plan** (it says only "via `useActionState`"), and
`listAdmins` is not either — the plan's admins page has no way to list anyone. Both
follow Task 10's `SudoForm` precedent: a `(prevState, FormData)` action posted from
`<form action={...}>` works without JavaScript.

### 2026-08-04 — Message lifetime is 8 hours, not the spec's original 24

Owner-requested after Task 8 merged, before Task 9 started. Every lifetime reference in
the spec, the plan, `design.md`, the code and the DB now says 8 hours.

**Two things that deliberately still say 24 and must stay that way:**
- **Admin ban duration** (the "Ban an `author_token_hash` for 24 hours" line in the spec, and the ban-confirm string in the plan). Moderation decision, independent of
  message lifetime.
- **`supabase/migrations/0001_schema.sql`.** Already applied live; `0005` is the record
  of the change. Never edit an applied migration to match current intent.

The fade-with-age curve in `design.md` § *Aesthetic risk: fade with age* was rescaled
with it (0–2/2–4/4–6/6–8), and `lib/age.ts` mirrors that table. **If the lifetime ever
changes again, these two must move together** — the curve is expressed in absolute
hours, so leaving it behind silently disables the fade rather than breaking anything
loudly.

### 2026-08-05 — Task 11 built UI the plan omitted, and corrected six things

The plan's Task 11 ships five Server Actions but builds UI for only three of them.
`toggleLock` and `purgeRoom` had **no call site anywhere**, which would have made them
unreachable dead code — while the plan's own Step 6 instructs you to verify locking in a
browser. `components/room/admin-bar.tsx` exists to close that gap and is not in the
plan's file list.

Likewise `PinnedStrip` is defined but **never rendered**, and nothing computes the
`pinned` array it takes. Wiring it from a server prop would have reproduced the Task 9
reactions bug exactly — pin state arrives as a Realtime UPDATE, so a prop-seeded strip
can never change. It is derived from the live message array in `MessageList`.

The other corrections — the plan's untestable `vi.doMock` (a non-UUID `adminId` breaks
`bans.created_by`), `window.confirm`, `void`-discarded results, pinning a deleted
message, purging already-expired rows, and banning an admin — are listed in full under
the Task 11 entry in Done.

**The `admin_id` / locked-room exemption gap the plan never addresses is recorded under
Blocked.** It needs an owner decision; do not resolve it silently.

### 2026-08-05 — Task 10 added migration `0007`, which the plan does not contain

The plan's Task 10 has no migration and no login rate limit. The **spec** (line 394)
requires one: *admin login attempt — 5 per 60 seconds per IP*. Without it `adminLogin`
is an unauthenticated bcrypt oracle on a public endpoint. `0007_admin_login_rate_limit.sql`
is applied live under that name.

The running rule, now hit three tasks in a row: **check `supabase/migrations/` for the
real highest number rather than trusting the plan's.** The plan's numbering has been
stale since `0005_eight_hour_expiry.sql` was inserted out of band.

### 2026-08-05 — Task 9's migration is `0006`, not the plan's `0005`

The plan was written before the eight-hour expiry change existed, and both claim the
number 0005. `0005_eight_hour_expiry.sql` is already applied, so the reaction migration
is `0006_reaction_counts.sql` and was applied live under that name. **The plan's Task 9
step 1 heading and its step 8 `git add` line still say 0005** — read them as 0006. Any
later task that adds a migration should check `supabase/migrations/` for the real
highest number rather than trusting the plan's.

### 2026-08-04 — Task 8/9 planned code corrections

Nine problems in the plan's code for Tasks 8 and 9, each one the plan contradicting its
own verification step.

**Task 8 — all five applied and verified. See the Task 8 entry under Done for detail.**
1. `useAnonToken` minted in `useEffect` + `setToken` (eslint error) → `useSyncExternalStore`.
2. Step 8 deleted `code-card.tsx`, losing the `>15 lines` collapse → `CodeCard` kept.
3. Highlighting only in an effect → server-rendered for the initial 100.
4. `renderCode` took unbounded input → same bounds as `postCode`.
5. `maxLength={1000}` made the over-length message unreachable → removed.

**Task 9 — all four applied and verified. See the Task 9 entry under Done for detail.**
6. **Reactions never updated live.** `Reactions` seeded state from props and nothing called
   `getReactions`; the `reaction_bump` UPDATE carries no counts. Step 7's "second window
   sees the count change" could not pass as written. The bump tells a client *that*
   something changed — it still has to fetch *what*. → `lib/use-reactions.ts`.
7. The reply preview used `style={{ color: replyTo.author_color }}` — the stored light
   hex, which fails WCAG AA on the dark background for all eight. → `authorColorVar()`.
8. `onJumpTo` was referenced but never defined, and no UI created a reply. → reply button,
   composer banner, and jump-to-highlight were built.
9. The tests reused the literal token `'reactor'` across several posts, which per Task 5
   exhausts its own rate quota on a second run inside the window. → `tok()`.

### 2026-08-04 — Author colors are a `design.md` token group, not the plan's hexes

Task 3 in the plan hardcodes eight author colors. Five are invented (`AGENTS.md`:
"No new colors"), and the other three are `pen`, `rule`, and `marigold` — each already
reserved for another job. A marigold handle in particular would read as a SUDO admin,
defeating the one thing `marigold` exists to signal.

Owner approved replacing them with a purpose-built palette, now `design.md` § Author
colors. `lib/identity.ts` mirrors the light column as `AUTHOR_COLORS`; the dark column
is `--author-1..8` in `globals.css`.

Constraints any future change must re-satisfy, all machine-checked:
- WCAG AA (>=4.5:1) against its own theme background.
- >=20 deltaE from `pen`, `rule`, `marigold`, `graphite` — in **both** themes.
- >=18 deltaE from every other author color.

`design.md` line 38 also changed: `graphite` no longer claims "handles".

### 2026-08-04 — Author colors live in `lib/author-color.ts`, resolved to CSS variables

Task 3 put `AUTHOR_COLORS` in `lib/identity.ts`, which is `server-only`. Task 7 needs the
palette in a **client** component to map a stored hex back to its theme-aware variable, so
the array moved to `lib/author-color.ts` and `lib/identity.ts` re-exports it. There is still
exactly one definition, and `design.md` § Author colors is still the source of truth.

`authorColorVar(stored)` returns `var(--author-N)`, not a hex. `messages.author_color`
stores the **light** column; rendering it inline gives 2.22–3.55:1 on the dark background
for all eight colors, against a 4.5 floor. The `--author-N` variables carry both columns and
swap with the `.dark` class.

An unrecognized hex falls back to `var(--ink)` rather than throwing — a row written before a
palette change should still be readable.

### 2026-08-04 — Room hierarchy gained a **year** level (commit `08774ee`)

The spec and plan originally scoped rooms as department → batch → group. They now read
department → **year** → batch → group. Requested by the project owner; caught before
Task 2 wrote any SQL, so there is no migration to rewrite.

- `years` is its **own table**, not a column on `batches`: the owner can then create an
  empty year up front, and every level of the tree keeps the same CRUD shape.
- `years.number` is `check (number between 1 and 5)` — 5 covers integrated courses.
- `batches.year_id` replaces `batches.department_id`; the unique key is
  `(year_id, number)`.
- Room URLs are now `/c/[dept]/[year]/[batch]/[group]`, e.g. `/c/cse/3/2/a`.
- `createYear({ departmentId, number })` is new in `app/actions/structure.ts`;
  `createBatch` takes `yearId`, not `departmentId`.

Both `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md` and the plan were
updated together. **Any file still assuming three levels is stale — trust the spec.**

---

## Notes

- `AGENTS.md` has the hard rules and the Next.js 16 gotchas that differ from training
  data. `middleware.ts` is `proxy.ts` now; `cookies()` is async; Server Actions
  dispatch sequentially.
- `design.md` is prescriptive. No improvised colors or fonts.

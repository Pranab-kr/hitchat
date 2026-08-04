# Progress

**If you are a new agent: read this file top to bottom before touching anything.**
This is the handoff document. It assumes you have no memory of prior sessions.

Then read `plan.md` (current step + next), run `git status`, and read only the spec
section for the step you're on. Full protocol in `AGENTS.md`.

---

## Resume here

| | |
|---|---|
| **Phase** | Implementing. Tasks 1–5 of 12 done. |
| **Current step** | **Task 6 — Shiki code rendering** — not yet started |
| **Branch** | `main` |
| **Next action** | Start Task 6 from `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` (line 1664): `git checkout -b feat/<task-6-slug>`, set this file to "In progress" and commit that first, then build. Do **not** re-apply migrations 0001–0004 — they are already live on project `vbbinzmpnszdayrdfsle`. |
| **Blocked?** | No. |
| **Last updated** | 2026-08-04 |

**Environment:** `.env.local` is complete — Supabase URL, publishable key,
`SUPABASE_SERVICE_ROLE_KEY`, a generated `IDENTITY_PEPPER`, and a generated
`OWNER_SECRET`. It is gitignored and verified not tracked. The secret key was pasted
into a chat transcript on 2026-08-04 and **should be rotated** in the Supabase
dashboard before this goes anywhere public.

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

*Nothing. Task 5 is merged; Task 6 has not been started.*

**Guard order is load-bearing: ban → lock → validate → rate limit.** The rate check
*records* an event, so a message rejected for length must not consume the user's quota.
A test enforces this; do not reorder them.

**Tests run with the service-role key against the live database.** Any new test that
posts must suffix its token with the per-run id (`tok()` in
`tests/messages-action.test.ts`), or it will exhaust its own rate-limit quota on the
second run inside a window.

**The RLS test is the most important test in the whole suite.** If any assertion in
`tests/rls.test.ts` fails, fix the migration — do not weaken the test.

**Schema note:** the room hierarchy is four levels — department → **year** → batch →
group. See the Deviations section.

---

## Blocked

*Nothing.*

---

## Deviations from plan

Anything built differently from `plan.md`, and why. Silence about a known deviation is
how the next agent undoes your work.

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

# Progress

**If you are a new agent: read this file top to bottom before touching anything.**
This is the handoff document. It assumes you have no memory of prior sessions.

Then read `plan.md` (current step + next), run `git status`, and read only the spec
section for the step you're on. Full protocol in `AGENTS.md`.

---

## Resume here

| | |
|---|---|
| **Phase** | Implementing. Tasks 1–2 of 12 done. Task 2 reviewed and merged. |
| **Current step** | **Task 3** — not yet started |
| **Branch** | `main` |
| **Next action** | Start Task 3 from `docs/superpowers/plans/2026-08-04-hitchat-implementation.md`: `git checkout -b feat/<task-3-slug>`, set this file to "In progress" and commit that first, then build. Do **not** re-apply the three migrations — they are already live on project `vbbinzmpnszdayrdfsle`. |
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
  must widen this consciously, not by accident.
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

*Nothing. Task 2 is merged; Task 3 has not been started.*

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

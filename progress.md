# Progress

**If you are a new agent: read this file top to bottom before touching anything.**
This is the handoff document. It assumes you have no memory of prior sessions.

Then read `plan.md` (current step + next), run `git status`, and read only the spec
section for the step you're on. Full protocol in `AGENTS.md`.

---

## Resume here

| | |
|---|---|
| **Phase** | Implementing. Task 1 of 12. |
| **Current step** | Task 1 — project setup: dependencies, design tokens, fonts, theming |
| **Branch** | `feat/setup-tokens-theme` (from `32f140a`) |
| **Next action** | Task 1 is in flight via a subagent. If resuming cold: read `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` Task 1, check `git log` on this branch for what landed, and continue from the first unchecked step. |
| **Blocked?** | Waiting on `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — needed from Task 2 onward, not for Task 1. |
| **Last updated** | 2026-08-04 |

**Environment:** `.env.local` exists with the Supabase URL, publishable key, a
generated `IDENTITY_PEPPER`, and a generated `OWNER_SECRET`. The service-role key is
still a placeholder and must be pasted from the Supabase dashboard before Task 2.

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

*Nothing in flight.*

When you start a step, replace this with:
- **Step:** name, from `plan.md`
- **Branch:** `feat/...`
- **Done so far:** files touched, what works
- **Immediately next:** the exact next edit

---

## Blocked

*Nothing.*

---

## Deviations from plan

Anything built differently from `plan.md`, and why. Silence about a known deviation is
how the next agent undoes your work.

*None yet.*

---

## Notes

- `AGENTS.md` has the hard rules and the Next.js 16 gotchas that differ from training
  data. `middleware.ts` is `proxy.ts` now; `cookies()` is async; Server Actions
  dispatch sequentially.
- `design.md` is prescriptive. No improvised colors or fonts.

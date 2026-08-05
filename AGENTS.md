<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# hitchat — agent conventions

Anonymous, self-destructing lab chat for college labs.

## Start here — every session, no exceptions

You may be a fresh agent with no memory of prior sessions. Before writing any code,
in this order:

1. **Read `progress.md`.** It states the current branch, the current step, and the
   exact next action. It is the handoff document.
2. **Run `git status` and `git branch --show-current`.** Reconcile against what
   `progress.md` claims. If they disagree, trust git for *what exists* and
   `progress.md` for *what was intended*, then say so before continuing.
3. **Read the spec section** for the feature you're touching. Only that section.
4. Only then start work.

**The original 12-task build plan is complete** (finished 2026-08-06 — all tasks are
recorded under Done in `progress.md`). The plan at
`docs/superpowers/plans/2026-08-04-hitchat-implementation.md` is now **history plus a
backlog**: its *Deferred to after launch* section at the end is the live list. Read the
plan's task bodies only when you need to know why something was built the way it was —
the code and `progress.md` are ahead of it in several places, all recorded under
Deviations.

If `progress.md` and the repo disagree in a way you can't reconcile, stop and ask.
Do not guess and do not restart a step that may already be half-done.

## The loop — one step at a time

Exactly one step is in flight at any moment. Never start step N+1 before step N is
merged.

```
1. git checkout main && git pull
2. git checkout -b feat/<step-slug>
3. Set progress.md → "In progress", commit that first
4. Build the step
5. Verify it actually works (run it, not just compile it)
6. Update progress.md: mark done, record deviations + next action
7. Commit, merge to main, delete the branch
8. Repeat
```

**Step 3 is the one people skip and it's the one that matters.** Writing "in
progress" *before* building is what lets a session that dies mid-step be recovered —
otherwise a fresh agent sees a branch with commits and no idea what they were for.

If you are interrupted or the context is about to run out, update `progress.md` first.
An accurate half-finished status beats a stale complete-looking one.

## Documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md` | The spec. Source of truth for behavior. |
| `design.md` | Visual system. Source of truth for every color, font, and spacing value. |
| `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` | The original 12-task build plan — **complete**. Now history plus the *Deferred to after launch* backlog at its end. There is no top-level `plan.md`. |
| `progress.md` | Running status and session handoff. **Update it as part of the work, not after.** |

If the spec and the code disagree, the spec wins — or the spec gets updated
deliberately. Never silently diverge.

## Workflow

See "The loop" above. One branch per step, `feat/<step-slug>`, branched from `main`.

The loop was written for the 12-task build and still applies to any multi-step feature.
For a genuinely small change — one file, one obvious fix — a direct commit on `main` is
fine; the point of the ceremony is recoverability, and there is nothing to recover from
a two-line change. Anything that spans files, touches the database, or could leave the
repo half-done gets a branch and a `progress.md` entry **written before the work**.

## Operations

- **Secrets.** `SUPABASE_SERVICE_ROLE_KEY` and `OWNER_SECRET` both leaked during the
  build and the rotation procedure is in `progress.md` under "Resume here". Rotate the
  owner secret with `bun run rotate-owner` (put the new value in `.env.local` first).
  **Never rotate `IDENTITY_PEPPER`** — it re-derives every anonymous handle and orphans
  every live ban.
- **The repo is public** (`Pranab-kr/hitchat`). Before pushing, confirm no secret value
  appears in a tracked file or in history. `.env.local`, `.claude`, `.mcp.json`,
  `.agents` and `skills-lock.json` are gitignored.
- **Migrations are applied live** to `vbbinzmpnszdayrdfsle` via the supabase MCP
  `apply_migration` tool, and the file in `supabase/migrations/` is the record. Check
  that directory for the real highest number — the plan's numbering went stale at 0005.
  **Never edit a migration that has already been applied.**
- **The live database holds real data.** There is a department the owner created by
  hand. Read before you delete, and never clear a table wholesale to tidy up after a
  test.

## Writing progress.md so the next agent can resume

`progress.md` is written for **an agent who knows nothing about this conversation.**
Assume no shared context. That means:

- **Never write "continue where I left off"** or "finish the remaining bits". Name the
  file, the function, and the next concrete action.
- Mark a step done **only when verified working**, not when the code is written.
- The **Next action** line is mandatory and must be executable as-is by someone who
  just opened the repo. "Add the rate-limit check to `postMessage` in
  `app/actions/messages.ts`" — not "continue rate limiting".
- Record **deviations from the implementation plan and why**. A silent deviation is how
  the next
  agent undoes your work.
- If blocked, put it in Blocked with what you tried. Don't mark the step done.
- Record decisions the next agent would otherwise re-litigate.

## Hard rules

- **Never store a secret in plaintext.** Admin secrets are hashed with bcrypt or
  argon2. This is not negotiable.
- **The service-role key never reaches the browser.** It lives only in Server Actions.
  If you find yourself importing it into a client component, stop.
- **Every write goes through a Server Action.** The publishable key has `SELECT` only.
  All rate limiting, ban checks, and admin authorization happen server-side.
- **Every admin action re-verifies its session.** `proxy.ts` is not authorization —
  the Next.js docs say so explicitly. Check the session inside the action itself.
- **Never trust a client-supplied role, admin flag, or token hash.** Derive them
  server-side.
- **A `'use server'` file may export ONLY async functions.** Exporting a plain object or
  constant from one makes the module throw at import time and every form on the page
  returns HTTP 500 — while the test suite, `tsc --noEmit` *and* `bun run build` all
  pass. Shared form-state constants live in `lib/owner-forms.ts` for this reason.
  Type-only exports are erased at compile time and are safe.
- **Adding a code language means changing three places at once:** the
  `code_lang_allowed` check constraint (a migration), `ALLOWED_LANGS` in
  `lib/validate.ts`, and the grammar imports in `lib/highlight.ts`. Miss the constraint
  and the database rejects a post that passed validation; miss the grammar and it
  renders as plaintext with no error. Tests in `tests/validate.test.ts` and
  `tests/highlight.test.ts` pin all three — if they fail, update all three rather than
  widening the expectation.
- **No new colors or fonts.** If `design.md` doesn't define it, it doesn't go in.
- Don't use stock shadcn appearance. If a component still looks like default shadcn,
  it isn't finished.
- At most one Magic UI component in the entire app. Default to zero.

## Verifying — a green suite is not enough

Two bugs in this project passed the full suite, `tsc`, and `bun run build`, and were
caught only by a real browser: the `'use server'` export rule above, and a server-side
capability whose UI still hid the control that would reach it.

- **Prove a guard by breaking it.** Delete or invert a new check and confirm the
  specific test covering it fails. A test that passes with *and* without the guard is
  not coverage.
- **Drive a new capability from the UI before calling it done.** A Server Action with no
  reachable call site is dead code, and a test that calls the action directly cannot
  see that.
- **Compare browser assertions exactly.** Playwright's `getByRole(name)` and `text=`
  match substrings. Never assert a 404 by looking for "could not be found" in page text
  — Next's dev overlay ships that string on every page. Assert on HTTP status.
- **Never target a message row with `.first()`/`.last()`.** Those re-resolve against a
  list Realtime is mutating. Capture the id, then target `[id="m-<uuid>"]`.
- **Tests run against the live database with the service-role key.** Any test that
  posts must use a per-run token suffix, and any test that inserts an admin must
  register its id for an `afterAll` sweep — cleaning up inline after an assertion leaks
  rows when that assertion fails.

## Next.js 16 gotchas

This project is on Next 16.2.12. Verified against the bundled docs:

- `cookies()`, `headers()`, `params`, `searchParams` are **async**.
- `cookieStore.set()`/`.delete()` work only in Server Actions and Route Handlers.
- `middleware.ts` is now **`proxy.ts`** — Node runtime only, not for authorization.
- Server Actions dispatch **sequentially per client**. Never `Promise.all` them.
- Return expected errors as values; read with `useActionState`. Don't throw.
- `revalidateTag` needs a second argument in v16.
- `next lint` is removed — run `eslint` directly.
- Turbopack is the default. No custom webpack config.

When unsure about any Next.js API, read `node_modules/next/dist/docs/` rather than
recalling it.

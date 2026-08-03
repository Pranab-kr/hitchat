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
2. **Read `plan.md`** — the step you are on, plus the one after it.
3. **Run `git status` and `git branch --show-current`.** Reconcile against what
   `progress.md` claims. If they disagree, trust git for *what exists* and
   `progress.md` for *what was intended*, then say so before continuing.
4. **Read the spec section** for the feature you're building. Only that section.
5. Only then start work.

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
| `plan.md` | Ordered build steps. |
| `progress.md` | Running status and session handoff. **Update it as part of the work, not after.** |

If the spec and the code disagree, the spec wins — or the spec gets updated
deliberately. Never silently diverge.

## Workflow

See "The loop" above. One branch per step, `feat/<step-slug>`, branched from `main`.
Never commit directly to `main` except for docs.

## Writing progress.md so the next agent can resume

`progress.md` is written for **an agent who knows nothing about this conversation.**
Assume no shared context. That means:

- **Never write "continue where I left off"** or "finish the remaining bits". Name the
  file, the function, and the next concrete action.
- Mark a step done **only when verified working**, not when the code is written.
- The **Next action** line is mandatory and must be executable as-is by someone who
  just opened the repo. "Add the rate-limit check to `postMessage` in
  `app/actions/messages.ts`" — not "continue rate limiting".
- Record **deviations from `plan.md` and why**. A silent deviation is how the next
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
- **No new colors or fonts.** If `design.md` doesn't define it, it doesn't go in.
- Don't use stock shadcn appearance. If a component still looks like default shadcn,
  it isn't finished.
- At most one Magic UI component in the entire app. Default to zero.

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

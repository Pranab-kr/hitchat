<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# hitchat — agent conventions

Anonymous, self-destructing lab chat for college labs. Read these before working.

## Documents

| File | What it is |
|---|---|
| `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md` | The spec. Source of truth for behavior. |
| `design.md` | Visual system. Source of truth for every color, font, and spacing value. |
| `plan.md` | Ordered build steps. |
| `progress.md` | Running status. **Update it as part of the work, not after.** |

If the spec and the code disagree, the spec wins — or the spec gets updated
deliberately. Never silently diverge.

## Workflow

1. **One branch per feature.** `feat/<slug>`, branched from `main`.
2. Build the feature. Update `progress.md` in the same branch.
3. Verify it actually works — not just that it compiles.
4. Merge to `main`, delete the branch.
5. Never commit directly to `main` except for docs.

## Updating progress.md

Mark a step done **only** when it is verified working, not when the code is written.
For each completed step record: what shipped, anything that deviated from the plan and
why, and anything the next step needs to know. If you got blocked, say so in the
Blocked section rather than marking the step done.

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

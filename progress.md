# Progress

Running status for hitchat. Updated as part of each step, not afterward.
Build order lives in `plan.md`. Behavior lives in the spec.

**Rule:** a step is done only when it is *verified working* — not when the code
compiles.

---

## Status

| | |
|---|---|
| Phase | Design complete, planning next |
| Current step | — |
| Branch | `main` |
| Last updated | 2026-08-03 |

---

## Done

- **2026-08-03 — Design spec approved.** Decisions locked: open access (no login),
  auto-derived anonymous handles, dedicated code-post type, owner + co-admin two-tier
  admin with DB-stored hashed secrets, SUDO badge, 24h purge with no exceptions
  (pins included), 5-minute self-delete window. Stack: Next.js 16 Server Actions for
  writes, Supabase Realtime for reads, pg_cron for purge, Vercel free tier.
  Visual direction: lab-record file — warm paper, blue ballpoint, red margin rule,
  with code cards as the signature element and messages fading as they age.
  → `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md`, `design.md`

---

## In progress

*Nothing yet.*

---

## Blocked

*Nothing.*

---

## Deviations from plan

Record anything built differently from `plan.md`, and why. Empty is fine; silence
about a known deviation is not.

*None yet.*

---

## Notes for whoever picks this up next

- Read `AGENTS.md` first — it has the hard rules and the Next.js 16 gotchas that
  differ from training data.
- The security model rests on one thing: the publishable key can only `SELECT`.
  Verify that with a real test before trusting anything else.
- `design.md` is prescriptive, not suggestive. No improvised colors.

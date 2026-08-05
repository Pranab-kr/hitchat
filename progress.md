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
| **Phase** | Implementing. Tasks 1–8 of 12 done. |
| **Current step** | **Task 9 — reactions and reply-to** — not yet started |
| **Branch** | `main` |
| **Next action** | Start Task 9 from `docs/superpowers/plans/2026-08-04-hitchat-implementation.md` (line 2713): `git checkout -b feat/reactions`, set this file to "In progress" and commit that first, then build. **Read the four Task 9 corrections in Deviations → *Task 8/9 planned code corrections* before writing any of it** — the plan's reaction code cannot pass its own step 7. Do **not** re-apply migrations 0001–0005 — they are already live on project `vbbinzmpnszdayrdfsle`. |
| **Blocked?** | No. |
| **Last updated** | 2026-08-05 |

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
  messages is barely a ban. `spec:365` and `plan:3711` still say 24 hours **on
  purpose**. Do not "make it consistent."

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

*Nothing. The 8-hour expiry change is merged; Task 9 has not been started.*

---

### Standing notes — read before any task

**Messages live 8 hours, not 24.** The fade curve in `lib/age.ts` is expressed in
absolute hours and must move with it if that ever changes again. **Admin bans are still
24 hours on purpose**, as is the already-applied `0001_schema.sql`.

**The Task 9 corrections in Deviations are not optional.** The plan's reaction component
never updates from the server, so its own step 7 ("a second window sees the count change")
cannot pass. Read that section before writing reaction code.

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

Anything built differently from the implementation plan, and why. Silence about a known
deviation is
how the next agent undoes your work.

### 2026-08-04 — Message lifetime is 8 hours, not the spec's original 24

Owner-requested after Task 8 merged, before Task 9 started. Every lifetime reference in
the spec, the plan, `design.md`, the code and the DB now says 8 hours.

**Two things that deliberately still say 24 and must stay that way:**
- **Admin ban duration** (`spec:365`, `plan:3711`). Moderation decision, independent of
  message lifetime.
- **`supabase/migrations/0001_schema.sql`.** Already applied live; `0005` is the record
  of the change. Never edit an applied migration to match current intent.

The fade-with-age curve in `design.md` § *Aesthetic risk: fade with age* was rescaled
with it (0–2/2–4/4–6/6–8), and `lib/age.ts` mirrors that table. **If the lifetime ever
changes again, these two must move together** — the curve is expressed in absolute
hours, so leaving it behind silently disables the fade rather than breaking anything
loudly.

### 2026-08-04 — Task 8/9 planned code corrections

Nine problems in the plan's code for Tasks 8 and 9, each one the plan contradicting its
own verification step.

**Task 8 — all five applied and verified. See the Task 8 entry under Done for detail.**
1. `useAnonToken` minted in `useEffect` + `setToken` (eslint error) → `useSyncExternalStore`.
2. Step 8 deleted `code-card.tsx`, losing the `>15 lines` collapse → `CodeCard` kept.
3. Highlighting only in an effect → server-rendered for the initial 100.
4. `renderCode` took unbounded input → same bounds as `postCode`.
5. `maxLength={1000}` made the over-length message unreachable → removed.

**Task 9 — NOT yet applied. Read this before writing reaction code.**
6. **Reactions never update live.** `Reactions` seeds state from props and nothing calls
   `getReactions`; the `reaction_bump` UPDATE carries no counts. Step 7's "second window
   sees the count change" cannot pass as written. The bump tells a client *that*
   something changed — it still has to fetch *what*.
7. The reply preview uses `style={{ color: replyTo.author_color }}` — the stored light
   hex. All eight fail WCAG AA on the dark background. Must use `authorColorVar()`.
8. `onJumpTo` is referenced but never defined, and no UI creates a reply, so the reply
   half of step 7 is untestable.
9. The tests reuse the literal token `'reactor'` across several posts. Per Task 5 that
   exhausts its own rate quota on a second run inside the window — use `tok()`.

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

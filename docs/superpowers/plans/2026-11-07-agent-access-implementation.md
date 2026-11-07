# Agent Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give hitchat three agent front doors — an HTTP API, a `hitchat` CLI, and a local plus hosted MCP server — that post as ordinary anonymous users with no login and no admin powers.

**Architecture:** All writes stay in the Next app. `lib/agent/` is the only place that resolves rooms, reads, and posts; `/api/agent/*` exposes it as JSON; `/api/mcp/[token]` exposes the same service as MCP; the published `agent/` package (CLI + stdio MCP) speaks the JSON API and holds no secrets.

**Tech Stack:** Next.js 16 route handlers, `@modelcontextprotocol/server` v2, Zod, the Supabase service client, `commander` and `tsdown` for the package.

**Spec:** `docs/superpowers/specs/2026-11-07-agent-access-design.md`

## Global Constraints

- Agent routes are Node runtime: `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` in every route file.
- No database migrations. Reuse the existing `text` and `code` rate-limit buckets.
- Guard order is fixed: ban → room lock → validation → rate limit → insert.
- Text ≤ 1,000 chars; code ≤ 50,000; title ≤ 80; lab tag ≤ 24; languages exactly `ALLOWED_LANGS` from `lib/validate.ts`.
- The agent path never calls `currentAdminId()`, never reads cookies, and always inserts `admin_id: null`.
- `SUPABASE_SERVICE_ROLE_KEY` and `IDENTITY_PEPPER` never appear outside the Next app.
- 8-hour expiry comes from the database default. Never set `expires_at` in an insert.
- No new colours, fonts, or components. `design.md` is the only visual source.
- Tests run against the live database: per-run token suffixes, and every inserted admin or room is swept in `afterAll`.
- A `'use server'` file exports only async functions.
- JSON APIs return the app's `ActionResult` shape: `{ ok: true, data }` or `{ ok: false, code, message, retryAfter? }`.

## Branch Strategy

One long-lived branch, `feat/agent-access`, cut from local `main`. All six phases commit there; it merges to `main` once, after phase 6. This is a deliberate deviation from `AGENTS.md`'s per-step merge, requested by the owner, and Task 0 records it in `progress.md`.

**Phase 1 is a gate.** If `createMcpHandler` does not work inside a Next route handler, stop and switch to a separate Hono app (approach C in the spec). Do not build phases 2-6 on a transport that has not been proven.

## Review Focus

The five things most likely to bite a real user, each pinned to a test in the task that owns the code:

1. **A pasted token with a trailing newline or a space** — must be a clean `401`, never a 500 or a silent different identity. (Task 4)
2. **A lowercase room path** (`cse/3/2/a`, which is exactly what the browser URL shows) — must resolve to the room, not 404. (Task 5)
3. **The sixth message in ten seconds** — must be `429` with a real `retryAfter`, and a post rejected for length must not consume a slot. (Task 8)
4. **A valid admin session cookie on an agent request** — must not produce `admin_id` and must not unlock a locked room. (Task 8)
5. **A read of a busy room** — must exclude soft-deleted and expired rows, and must not return megabytes of code. (Task 6)

---

## Phase 0 — Branch and handoff

### Task 0: Create the branch and write the handoff

**Files:**
- Modify: `progress.md` (top "Resume here" block and a new in-progress section)

**Interfaces:**
- Consumes: nothing.
- Produces: branch `feat/agent-access`, with a `progress.md` a fresh agent can resume from.

- [ ] **Step 1: Cut the branch from local main**

```bash
git checkout main
git checkout -b feat/agent-access
```

Do not `git pull`. `progress.md` records that local `main` is intentionally ahead and unpushed.

- [ ] **Step 2: Write the in-progress state**

Update the "Resume here" table: Phase = "In progress — agent access, phase 1 of 6 (MCP pipe gate)", Branch = `feat/agent-access`, Next action = "Run `bun run scripts/mcp-probe.ts http://localhost:3000/api/mcp/probe-token` and confirm `tools/list` returns `ping` (Task 3)." Also add, under a short **Deviation** heading: phases commit to this branch and merge to `main` once after phase 6, instead of one branch per step.

- [ ] **Step 3: Commit the handoff before any code**

```bash
git add progress.md
git commit -m "docs: start agent access on feat/agent-access"
```

---

## Phase 1 — Prove the MCP pipe (gate)

### Task 1: Install the MCP server and Zod

**Files:**
- Modify: `package.json`, `bun.lock`

**Interfaces:**
- Consumes: nothing.
- Produces: `@modelcontextprotocol/server` and `zod` importable from app code.

- [ ] **Step 1: Install**

```bash
bun add @modelcontextprotocol/server zod
```

Pin whatever `bun` resolves; sendkit uses `@modelcontextprotocol/server@^2.4.0` and `zod@4.4.3`, so expect the same majors.

- [ ] **Step 2: Prove the import works under the app's TypeScript**

Create `scripts/check-mcp-import.ts` with only:

```ts
import { McpServer } from '@modelcontextprotocol/server'
console.log(typeof McpServer)
```

Run `bun run scripts/check-mcp-import.ts`. Expected: `function`. Delete the script.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add the MCP server SDK and zod"
```

### Task 2: Write the probe before the route

**Files:**
- Create: `scripts/mcp-probe.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `bun run scripts/mcp-probe.ts <url>` exits `0` when `initialize` and `tools/list` succeed, prints the tool names, and exits `1` otherwise. Used again in Phase 5.

- [ ] **Step 1: Write the probe**

It must: POST `initialize` with `{ protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'hitchat-probe', version: '0' } }`; POST `notifications/initialized`; POST `tools/list`; accept either `application/json` or an SSE body (join `data:` lines and parse the last one); print `TOOLS: <names>`; exit `1` on any non-2xx or JSON-RPC error.

Send these headers on every request — the SDK rejects a missing `Accept`:

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

- [ ] **Step 2: Run it against the route that does not exist yet**

Start the dev server in one terminal (`bun dev`), then:

```bash
bun run scripts/mcp-probe.ts http://localhost:3000/api/mcp/probe-token
```

Expected: fails, `404` or a non-JSON body. This is the failing test.

- [ ] **Step 3: Commit the probe**

```bash
git add scripts/mcp-probe.ts
git commit -m "test: add an MCP probe script"
```

### Task 3: The dummy MCP route

**Files:**
- Create: `app/api/mcp/[token]/route.ts`

**Interfaces:**
- Consumes: `createMcpHandler`, `McpServer` from `@modelcontextprotocol/server`.
- Produces: `GET`, `POST`, `DELETE` handlers at `/api/mcp/<token>`, with one tool named `ping` that returns the text `pong`. Phase 5 replaces the tool set and keeps the route shape.

- [ ] **Step 1: Write the route**

Shape (sendkit's `apps/remote-mcp/src/index.ts` is the reference):

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler(
  () => {
    const server = new McpServer({ name: 'hitchat', version: '0.0.0' })
    server.registerTool('ping', { title: 'Ping', description: 'Returns pong' }, async () => ({
      content: [{ type: 'text', text: 'pong' }],
    }))
    return server
  },
  { responseMode: 'json' },
)

export async function GET(req: Request) { return handler.fetch(req) }
export async function POST(req: Request) { return handler.fetch(req) }
export async function DELETE(req: Request) { return handler.fetch(req) }
```

If `createMcpHandler`'s factory receives `{ requestInfo }` in this SDK version, ignore the argument here; Phase 5 uses it.

- [ ] **Step 2: Run the probe against it**

```bash
bun run scripts/mcp-probe.ts http://localhost:3000/api/mcp/probe-token
```

Expected: `TOOLS: ping`, exit `0`.

- [ ] **Step 3: Call the tool**

Extend nothing; use `curl` for the one call:

```bash
curl -s -X POST http://localhost:3000/api/mcp/probe-token \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ping","arguments":{}}}'
```

Expected: a JSON-RPC result whose content text is `pong`.

- [ ] **Step 4: Prove it survives a production build**

```bash
bun run build
bun start
```

Run the probe against `http://localhost:3000/api/mcp/probe-token` again. Expected: same result. A dev-only success is not a pass — this is the gate.

- [ ] **Step 5: Commit**

```bash
git add "app/api/mcp/[token]/route.ts"
git commit -m "feat: prove the MCP handler runs in a Next route"
```

**Gate:** if any of steps 2-4 fail after a reasonable fix, stop and report. The fallback is approach C (separate Hono app), which changes Phase 5 only.

---

## Phase 2 — Agent core and HTTP API

### Task 4: Token helpers

**Files:**
- Create: `lib/agent/token.ts`
- Test: `tests/agent-token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export const TOKEN_PATTERN: RegExp // /^[A-Za-z0-9_-]{16,128}$/
export function isToken(value: unknown): value is string
export function tokenFromHeader(req: Request): string | null   // Bearer first, then x-hitchat-token
export function tokenFromPath(pathname: string): string | null // last non-empty segment
```

- [ ] **Step 1: Write the failing tests**

- `accepts a UUID from Authorization: Bearer`
- `accepts a token from x-hitchat-token`
- `rejects a token with a trailing newline` — `'abcd...1234\n'` → `null`
- `rejects a 15-character token` and `rejects a 129-character token`
- `rejects a token containing a space`
- `reads the last path segment` — `/api/mcp/abc123def456ghi789` → `abc123def456ghi789`
- `ignores a trailing slash` — `/api/mcp/abc123def456ghi789/` → same
- `prefers the header over the path` when both are present

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-token.test.ts
```

Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helpers**

Trim the header value before testing it. Return `null`, never throw — the callers turn `null` into a `401`.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run test tests/agent-token.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/agent/token.ts tests/agent-token.test.ts
git commit -m "feat: add agent token parsing"
```

### Task 5: Extract the room lookup and add `listRooms`

**Files:**
- Create: `lib/rooms-server.ts`, `lib/agent/rooms.ts`
- Modify: `app/c/[dept]/[year]/[batch]/[group]/page.tsx`
- Test: `tests/rooms-server.test.ts`, `tests/agent-rooms.test.ts`

**Interfaces:**
- Consumes: `getServiceClient`, `seedRoom` from `tests/helpers/seed-room.ts`.
- Produces:

```ts
// lib/rooms-server.ts
export type RoomHit = { id: string; label: string; isLocked: boolean; deptName: string }
export async function findRoomByPath(
  dept: string, year: number, batch: number, group: string,
): Promise<RoomHit | null>

// lib/agent/rooms.ts
export type RoomSummary = {
  path: string; dept: string; year: number; batch: number; group: string; locked: boolean
}
export type ResolvedRoom = RoomHit & {
  dept: string; year: number; batch: number; group: string
}
export function parseRoomPath(input: string):
  { dept: string; year: number; batch: number; group: string } | null
export async function listRooms(): Promise<RoomSummary[]>
export async function resolveRoom(input: string): Promise<ResolvedRoom | null>
```

`path` is always `"<dept-slug>/<year>/<batch>/<LABEL-AS-STORED>"`, e.g. `cse/3/2/A`.

- [ ] **Step 1: Write the failing tests**

`tests/rooms-server.test.ts`:
- `finds a room by slug, year, batch and uppercase label` → `{ label: 'A', isLocked: false, deptName: 'Test Dept' }`
- `finds the same room when the slug and label are lowercase`
- `returns null for a missing room`
- `returns null for a non-integer year` (the page rejects it before querying; the helper must too)

`tests/agent-rooms.test.ts`:
- `parses cse/3/2/A` and `parses CSE/3/2/a` to the same values
- `rejects cse/three/2/A`, `rejects cse/3/2`, `rejects an empty string`
- `lists the seeded room as <slug>/1/1/A with locked false`
- `lists it as locked after is_locked is set true` (update the group row in the test, reset in `afterAll`)

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/rooms-server.test.ts tests/agent-rooms.test.ts
```

- [ ] **Step 3: Implement**

`findRoomByPath` is the room page's query moved verbatim, with `dept.toLowerCase()` and `group.toUpperCase()` applied. It returns the already-normalised `deptName` (the page's `one(one(batch.years).departments).name` logic moves here). The page then deletes its inline `one()` helpers and its `deptName` computation.

`listRooms` queries `departments(name, slug, years(number, batches(number, groups(label, is_locked))))`, prunes empty nodes exactly as `lib/room-tree.ts` does, and sorts the same way.

- [ ] **Step 4: Run the unit tests, then the page**

```bash
bun run test tests/rooms-server.test.ts tests/agent-rooms.test.ts
```

Then with `bun dev` running, open an existing room URL and a nonexistent one. Expected: the room renders its title and message list; the bad path is HTTP 404. This refactor touches a live page, so the browser check is part of the task.

- [ ] **Step 5: Commit**

```bash
git add lib/rooms-server.ts lib/agent/rooms.ts tests/rooms-server.test.ts tests/agent-rooms.test.ts "app/c/[dept]/[year]/[batch]/[group]/page.tsx"
git commit -m "refactor: share room lookup between the page and agents"
```

### Task 6: Read messages

**Files:**
- Create: `lib/agent/read.ts`
- Test: `tests/agent-read.test.ts`

**Interfaces:**
- Consumes: `getServiceClient`, `seedRoom`.
- Produces:

```ts
export type AgentMessage = {
  id: string; author: string; kind: 'text' | 'code'; body: string
  lang: string | null; title: string | null; lab_tag: string | null
  reply_to_id: string | null; pinned: boolean
  created_at: string; expires_at: string; truncated?: true
}
export async function readMessages(groupId: string, limit?: number): Promise<AgentMessage[]>
```

- [ ] **Step 1: Write the failing tests**

Seed a room, insert four messages directly with the service client: a live text, a soft-deleted text, an expired text (`expires_at` in the past), and a 10,000-character code post.

- `returns only live undeleted messages, oldest first`
- `defaults to 20 and clamps 500 down to 50`
- `truncates a long code body to 8000 characters and marks it truncated`
- `uses the most recent 50, not the oldest 50` (insert 3 messages, call with `limit: 2`, expect the last two ids)

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-read.test.ts
```

- [ ] **Step 3: Implement**

Order `created_at` descending in SQL with `.limit(n)`, then `reverse()` in code — an ascending query with a limit returns the oldest rows, which is the trap named in the spec. Filter with `.is('deleted_at', null)` and `.gt('expires_at', new Date().toISOString())`.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run test tests/agent-read.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/agent/read.ts tests/agent-read.test.ts
git commit -m "feat: read a room snapshot for agents"
```

### Task 7: `not_found` and the HTTP response mapper

**Files:**
- Modify: `lib/result.ts`
- Create: `lib/agent/http.ts`
- Test: `tests/agent-http.test.ts`, `tests/agent-result.test.ts`

**Interfaces:**
- Consumes: `ActionResult`, `ok`, `err`.
- Produces:

```ts
// lib/result.ts
export type ActionErrorCode = ... | 'not_found'

// lib/agent/http.ts
export function jsonResult<T>(result: ActionResult<T>): Response
export function errorJson(code: ActionErrorCode, message: string, retryAfter?: number): Response
```

- [ ] **Step 1: Write the failing tests**

- `err('not_found', 'No such room.')` carries code `not_found`
- `maps invalid to 400, unauthorized to 401, banned to 403, locked to 403, not_found to 404, rate_limited to 429, server to 500`
- `a successful result is 200 with { ok: true, data }`
- `rate_limited sets Retry-After` to `String(retryAfter)`
- `the body is the ActionResult shape` — `await res.json()` deep-equals the input result

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-http.test.ts tests/agent-result.test.ts
```

- [ ] **Step 3: Implement**

Add the union member, then the mapper. Run `bunx tsc --noEmit` — any exhaustive `switch` over `ActionErrorCode` that now misses a case is a real bug in the UI and must be handled, not cast away.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run test tests/agent-http.test.ts tests/agent-result.test.ts
bunx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/result.ts lib/agent/http.ts tests/agent-http.test.ts tests/agent-result.test.ts
git commit -m "feat: map agent results to HTTP responses"
```

### Task 8: The only agent write path

**Files:**
- Create: `lib/agent/post.ts`
- Test: `tests/agent-post.test.ts`

**Interfaces:**
- Consumes: `hashToken`, `deriveHandle`, `validateText`, `validateCode`, `assertNotBanned`, `assertRoomOpen`, `assertRateOk`, `getServiceClient`, `seedRoom`, `testDb`.
- Produces:

```ts
export async function postAgentText(input: {
  hash: string; groupId: string; text: string; replyToId?: string
}): Promise<ActionResult<{ id: string }>>

export async function postAgentCode(input: {
  hash: string; groupId: string; code: string; lang: string
  title?: string; labTag?: string; replyToId?: string
}): Promise<ActionResult<{ id: string }>>
```

- [ ] **Step 1: Write the failing tests**

Use a per-run token: `` const TOKEN = `agent-test-${Date.now()}-${crypto.randomUUID()}` `` and `hash = hashToken(TOKEN)`. Sweep messages by `group_id` and delete seeded rooms in `afterAll`.

- `inserts a text message with derived name/color and admin_id null`
- `inserts a code message with lang, title and lab tag`
- `rejects a banned token with code banned` (insert a `bans` row, delete it after)
- `rejects a locked room with code locked` (set `is_locked`, reset after)
- `rejects text over 1000 characters with invalid`
- `does not consume quota when validation fails` — post 5 valid, then 1 invalid, then 1 more valid inside the window; the last must succeed
- `allows 5 texts in 10 seconds and rejects the 6th with rate_limited and a retryAfter` — assert `retryAfter` is a number 1-10
- `rejects an unknown language with invalid`
- `rejects a malformed reply_to_id with invalid`
- `rejects a reply_to_id from another room with invalid`
- `a valid admin cookie does not set admin_id` — insert an admin row (`bcrypt.hash('x', 4)`), insert an `admin_sessions` row with `token = createHash('sha256').update(raw).digest('hex')`, call `postAgentText` directly (the function takes no request, so the cookie cannot reach it), then assert the row's `admin_id` is `null`. This proves the function has no cookie seam at all. Delete the admin and session after.

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-post.test.ts
```

- [ ] **Step 3: Implement**

Guard order exactly: `assertNotBanned` → `assertRoomOpen` → validate → `assertRateOk` → insert. Validate the reply id before the rate check. Insert with `admin_id: null` and never pass `expires_at`.

- [ ] **Step 4: Prove the guard by breaking it**

Temporarily change the insert to `admin_id: '00000000-0000-0000-0000-000000000000'` and confirm `a valid admin cookie does not set admin_id` fails. Revert. Then remove `assertRoomOpen` and confirm the locked test fails. Revert.

- [ ] **Step 5: Run and confirm pass**

```bash
bun run test tests/agent-post.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/agent/post.ts tests/agent-post.test.ts
git commit -m "feat: add the anonymous agent write path"
```

### Task 9: The HTTP API

**Files:**
- Create: `lib/agent/schemas.ts`, `app/api/agent/rooms/route.ts`, `app/api/agent/messages/route.ts`, `app/api/agent/code/route.ts`
- Test: `tests/agent-api.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4-8.
- Produces: the four endpoints in the spec, each returning `ActionResult` JSON with the mapped status.

```ts
// lib/agent/schemas.ts
export const textBody = z.object({
  room: z.string().min(1), text: z.string(), reply_to_id: z.string().uuid().optional(),
})
export const codeBody = z.object({
  room: z.string().min(1), code: z.string(), lang: z.enum(ALLOWED_LANGS),
  title: z.string().max(80).optional(), lab_tag: z.string().max(24).optional(),
  reply_to_id: z.string().uuid().optional(),
})
```

- [ ] **Step 1: Write the failing tests**

Call the exported handlers directly with `new Request(...)`; no server needed. If `Request` is missing under the root `jsdom` environment, put `// @vitest-environment node` at the top of this file — route handlers are Node code and belong in the node environment anyway.

- `GET /api/agent/rooms returns the seeded room and 401s without a token`
- `POST messages sends a text and returns id, room and url` (the `url` ends with `/c/<slug>/1/1/A`)
- `POST messages rejects a malformed JSON body with 400 invalid`
- `POST messages on a locked room returns 403 locked`
- `POST messages with a banned token returns 403 banned`
- `POST messages 6 times returns 429 on the sixth and sets Retry-After`
- `POST code with lang "rust" returns 400 invalid`
- `GET messages?room=... returns the live messages and excludes a deleted one`
- `GET messages for an unknown room returns 404 not_found`
- `a token with a trailing newline returns 401` (the Review Focus case)
- `a lowercase room path posts successfully` (the Review Focus case)
- `a valid admin cookie does not create a SUDO message` — insert an admin and an `admin_sessions` row (`sha256(raw)` hex), send `Cookie: hitchat_admin=<raw>` on the POST, and assert the inserted row's `admin_id` is `null`
- `a valid admin cookie does not unlock a locked room` — same cookie, locked room, expect `403 locked`

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-api.test.ts
```

- [ ] **Step 3: Implement the routes**

Every handler: `tokenFromHeader` → `isToken` → `hashToken` → parse body/query → `resolveRoom` (`not_found` when null) → service call → `jsonResult`. The `url` is built as `new URL(\`/c/${dept}/${year}/${batch}/${group.toLowerCase()}\`, req.url).toString()`.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run test tests/agent-api.test.ts
```

- [ ] **Step 5: Drive it with curl against the dev server**

```bash
curl -s http://localhost:3000/api/agent/rooms -H "Authorization: Bearer agent-curl-$(date +%s)-abcdef"
curl -s -X POST http://localhost:3000/api/agent/messages \
  -H "Authorization: Bearer agent-curl-$(date +%s)-abcdef" \
  -H "Content-Type: application/json" \
  -d '{"room":"<real-room-path>","text":"hello from curl"}'
```

Expected: the first lists rooms; the second returns `{ ok: true, data: { id, room, url, ... } }`. Open the `url` in the browser and confirm the message is on screen under a derived handle with no SUDO badge. Delete the message row afterwards.

- [ ] **Step 6: Commit**

```bash
git add lib/agent/schemas.ts app/api/agent tests/agent-api.test.ts
git commit -m "feat: expose the agent HTTP API"
```

---

## Phase 3 — The CLI

### Task 10: Package scaffold and root exclusions

**Files:**
- Create: `agent/package.json`, `agent/tsconfig.json`, `agent/tsdown.config.ts`, `agent/vitest.config.ts`, `agent/src/config.ts`
- Modify: `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `package.json` (root scripts)
- Test: `agent/tests/config.test.ts`

**Interfaces:**
- Produces: `readConfig()`, `writeConfig(config)`, `configPath()` in `agent/src/config.ts`.

```ts
export type Config = { url: string; token: string }
export function configPath(): string          // HITCHAT_CONFIG || ~/.config/hitchat/config.json
export function readConfig(): Config | null
export function writeConfig(config: Config): void  // mkdir -p, mode 0o600
```

- [ ] **Step 1: Write the failing test**

`writeConfig` then `readConfig` round-trips `{ url, token }` when `HITCHAT_CONFIG` points at a temp file; `readConfig` returns `null` when the file is absent; `readConfig` returns `null` when the JSON lacks either key.

- [ ] **Step 2: Run and confirm failure**

```bash
bun run --cwd agent test
```

- [ ] **Step 3: Create the package and the exclusions**

`agent/package.json`: `"name": "@pranabkr/hitchat-agent"`, `"type": "module"`, `"bin": { "hitchat": "./dist/cli.js", "hitchat-mcp": "./dist/mcp.js" }`, `"files": ["dist"]`, `"publishConfig": { "access": "public" }`, scripts `build` (`tsdown`), `test` (`vitest run`), `pack:dry` (`bun run build && bun pm pack --dry-run`), `prepublishOnly`. Dependencies: `@modelcontextprotocol/server`, `commander`, `zod`. Dev: `tsdown`, `typescript`, `vitest`.

Root edits: `tsconfig.json` `exclude` gains `"agent"`; `eslint.config.mjs` `globalIgnores` gains `"agent/**"`; `vitest.config.ts` `test.exclude` becomes `[...configDefaults.exclude, 'agent/**']` — import `configDefaults` from `vitest/config`, because assigning `exclude` replaces the defaults and would stop ignoring `node_modules`; `.gitignore` gains `agent/node_modules` and `agent/dist`; root `package.json` gains `"agent:build": "bun run --cwd agent build"` and `"agent:test": "bun run --cwd agent test"`.

- [ ] **Step 4: Install and run**

```bash
bun install --cwd agent
bun run agent:test
bun run test
bunx tsc --noEmit
```

Expected: the package test passes, the app suite is unchanged, and TypeScript does not compile `agent/`.

- [ ] **Step 5: Commit**

```bash
git add agent tsconfig.json eslint.config.mjs vitest.config.ts .gitignore package.json bun.lock
git commit -m "chore: scaffold the hitchat agent package"
```

### Task 11: The API client

**Files:**
- Create: `agent/src/types.ts`, `agent/src/client.ts`
- Test: `agent/tests/client.test.ts`

**Interfaces:**
- Produces:

```ts
// agent/src/types.ts — the package cannot import from the app, so it restates the shapes
export type RoomSummary = { path: string; dept: string; year: number; batch: number; group: string; locked: boolean }
export type AgentMessage = { id: string; author: string; kind: 'text' | 'code'; body: string; lang: string | null; title: string | null; lab_tag: string | null; reply_to_id: string | null; pinned: boolean; created_at: string; expires_at: string; truncated?: true }
export type SentMessage = { id: string; room: string; url: string; expires_at: string }
```

```ts
export class HitchatError extends Error { code: string; retryAfter?: number }
export async function apiCall<T>(config: Config, path: string, init: RequestInit, fetchImpl?: typeof fetch): Promise<T>
export function listRooms(config, fetchImpl?): Promise<RoomSummary[]>
export function readMessages(config, room, limit?, fetchImpl?): Promise<AgentMessage[]>
export function sendMessage(config, input, fetchImpl?): Promise<SentMessage>
export function sendCode(config, input, fetchImpl?): Promise<SentMessage>
```

`SentMessage` is `{ id: string; room: string; url: string; expires_at: string }`.

- [ ] **Step 1: Write the failing tests** against a stub `fetchImpl` (no network)

- `sends Authorization: Bearer <token>` and the configured base URL
- `throws HitchatError with the server code and message on 429`, and copies `retryAfter`
- `throws HitchatError with code "network"` when fetch rejects
- `sendMessage posts to /api/agent/messages with { room, text, reply_to_id }`
- `sendCode posts to /api/agent/code`

- [ ] **Step 2: Run and confirm failure**

```bash
bun run --cwd agent test agent/tests/client.test.ts
```

- [ ] **Step 3: Implement**

`apiCall` joins `config.url` and `path` without a double slash, parses the JSON body, and converts `{ ok: false }` into a `HitchatError`.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run agent:test
```

- [ ] **Step 5: Commit**

```bash
git add agent/src/client.ts agent/tests/client.test.ts
git commit -m "feat: add the agent HTTP client"
```

### Task 12: CLI commands

**Files:**
- Create: `agent/src/cli.ts`
- Test: `agent/tests/cli.test.ts`

**Interfaces:**
- Produces:

```ts
export async function runCli(
  argv: string[],
  io: { out: (s: string) => void; err: (s: string) => void },
  fetchImpl?: typeof fetch,
): Promise<number>
```

- [ ] **Step 1: Write the failing tests**

- `init --url ... --token ... writes the config and prints {"ok":true}`
- `init --new generates a 36-character UUID token`
- `init without a url exits 2 with a usage message`
- `rooms prints the room paths`
- `send posts the message and prints id and url`
- `send --code-file reads the file and posts lang from --lang`
- `a 429 prints the server message to err and exits 1`

Use a temp `HITCHAT_CONFIG` and a stub `fetchImpl`.

- [ ] **Step 2: Run and confirm failure**

```bash
bun run agent:test agent/tests/cli.test.ts
```

- [ ] **Step 3: Implement with `commander`**

Commands: `init`, `rooms`, `read <room>`, `send <room> <message>` with `--code-file`, `--lang`, `--title`, `--lab`, `--limit`. Every success prints `JSON.stringify(data)`. `init` calls `/api/agent/rooms` once before writing.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run agent:test
```

- [ ] **Step 5: Commit**

```bash
git add agent/src/cli.ts agent/tests/cli.test.ts
git commit -m "feat: add the hitchat CLI"
```

### Task 13: Build and drive the real binary

**Files:**
- Modify: `agent/package.json` only if the build output path differs.

**Interfaces:**
- Consumes: the built `agent/dist/cli.js`.
- Produces: a working `hitchat` binary proven against a real server.

- [ ] **Step 1: Build**

```bash
bun run agent:build
ls agent/dist   # cli.js and mcp.js must exist
```

- [ ] **Step 2: Initialise against the dev server**

```bash
node agent/dist/cli.js init --url http://localhost:3000 --new
node agent/dist/cli.js rooms
```

Expected: a config with a UUID token, then the room list.

- [ ] **Step 3: Send, read, and verify in the browser**

```bash
node agent/dist/cli.js send <room-path> "sent by the hitchat CLI"
node agent/dist/cli.js read <room-path> --limit 5
```

Open the room URL. Expected: the message is visible, under a derived handle, no SUDO badge. `read` shows it. Delete the row afterwards.

- [ ] **Step 4: Commit**

```bash
git add agent
git commit -m "chore: verify the built CLI end to end"
```

---

## Phase 4 — Local MCP

### Task 14: Tool names and the stdio server

**Files:**
- Create: `agent/src/names.ts`, `agent/src/tools.ts`, `agent/src/mcp.ts`
- Test: `agent/tests/tools.test.ts`

**Interfaces:**
- Produces:

```ts
// agent/src/names.ts — no imports, so the app test can read it
export const TOOL_NAMES = ['list_rooms', 'read_messages', 'send_message', 'send_code'] as const

// agent/src/tools.ts
export function registerTools(server: McpServer, config: Config, fetchImpl?: typeof fetch): void

// agent/src/mcp.ts — the bin
serveStdio(() => { ... })  // reads HITCHAT_URL/HITCHAT_TOKEN or the config file
```

- [ ] **Step 1: Write the failing test**

With a fake server object that records `registerTool` calls: `registerTools registers exactly the four names in TOOL_NAMES`, and `each tool handler returns text content, not a bare string`.

- [ ] **Step 2: Run and confirm failure**

```bash
bun run agent:test agent/tests/tools.test.ts
```

- [ ] **Step 3: Implement**

Each handler calls the client and returns `{ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }`. On `HitchatError`, return `{ content: [{ type: 'text', text: error.message }], isError: true }`.

Tool descriptions must state: paths come from `list_rooms`; text is 1,000 characters; code is 50,000; everything disappears in 8 hours; there are no admin actions.

- [ ] **Step 4: Run and confirm pass**

```bash
bun run agent:test
bun run agent:build
```

- [ ] **Step 5: Drive it with a real MCP client**

Add a temporary `.mcp.json` entry (gitignored) pointing at `node <abs path>/agent/dist/mcp.js` with `HITCHAT_URL` and `HITCHAT_TOKEN` in `env`, then call `list_rooms` and `send_message` from the agent. Verify in the browser. Delete the message.

- [ ] **Step 6: Commit**

```bash
git add agent
git commit -m "feat: add the local stdio MCP server"
```

---

## Phase 5 — Hosted MCP

### Task 15: The four hosted tools

**Files:**
- Create: `lib/agent/mcp-names.ts`, `lib/agent/mcp.ts`
- Modify: `app/api/mcp/[token]/route.ts`
- Test: `tests/agent-mcp.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/agent/mcp-names.ts
export const MCP_TOOL_NAMES = ['list_rooms', 'read_messages', 'send_message', 'send_code'] as const

// lib/agent/mcp.ts
export function registerHostedTools(server: McpServer, hash: string): void
```

- [ ] **Step 1: Write the failing tests**

- `the hosted and local tool name lists are identical` — imports `MCP_TOOL_NAMES` and `../../agent/src/names`
- `registerHostedTools registers exactly four tools`
- `the send handler calls postAgentText with the hashed token` — assert the hash equals `hashToken(TOKEN)`, never the raw token

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/agent-mcp.test.ts
```

- [ ] **Step 3: Implement**

Handlers call `listRooms`, `readMessages`, `postAgentText`, `postAgentCode` directly. Return `isError: true` with the message on failure.

- [ ] **Step 4: Replace the route's tool set**

Keep the route's exports, runtime and `dynamic` flags. Resolve the token as `tokenFromHeader(req) ?? tokenFromPath(new URL(req.url).pathname)`, require `isToken`, hash it, and build the server per request with `registerHostedTools`.

- [ ] **Step 5: Run and confirm pass**

```bash
bun run test tests/agent-mcp.test.ts
bun run build
```

- [ ] **Step 6: Drive it with the probe**

```bash
bun start
bun run scripts/mcp-probe.ts http://localhost:3000/api/mcp/<real-token>
```

Expected: `TOOLS: list_rooms read_messages send_message send_code`, then a `tools/call` for `send_message` in the browser, then delete the row.

- [ ] **Step 7: Commit**

```bash
git add lib/agent app/api/mcp tests/agent-mcp.test.ts
git commit -m "feat: serve the four agent tools over hosted MCP"
```

### Task 16: Connector verification

**Files:** none.

- [ ] **Step 1: Claude Code / any local client**

Add the hosted URL as an HTTP MCP server with the token in the path and call `list_rooms`.

- [ ] **Step 2: ChatGPT or Claude web**

Only if the app is publicly reachable: add a connector, paste `https://<host>/api/mcp/<token>`, choose no authentication, and call `send_message`. If it is not deployed, record that in `progress.md` as the one unverified step and do not claim it works.

---

## Phase 6 — Connect page, docs, publish

### Task 17: `/agent`

**Files:**
- Create: `app/agent/page.tsx`, `components/agent/connect-panel.tsx`
- Modify: `app/page.tsx` (one footer link)
- Test: `tests/connect-panel.test.tsx`

**Interfaces:**
- Consumes: `useAnonToken`.
- Produces: a page at `/agent` that shows the token, the MCP URL, three copy-paste blocks, and the warning.

- [ ] **Step 1: Write the failing test**

`renders the MCP URL containing the current token`; `renders the warning that the URL is the identity`; `the new-identity button issues a UUID and does not overwrite the stored token`.

- [ ] **Step 2: Run and confirm failure**

```bash
bun run test tests/connect-panel.test.tsx
```

- [ ] **Step 3: Implement**

Server component `app/agent/page.tsx` for the shell and metadata; client `connect-panel.tsx` for the token. Use only existing tokens from `design.md`. Build the host from the current request on the server and pass it down.

- [ ] **Step 4: Run, then look at it in a browser**

```bash
bun run test tests/connect-panel.test.tsx
bun dev
```

Open `/agent` at 375px and 1280px. Expected: no overflow, the copy blocks scroll, the warning is visible without scrolling at desktop size. Then from `/`, the footer link reaches it.

- [ ] **Step 5: Commit**

```bash
git add app/agent components/agent app/page.tsx tests/connect-panel.test.tsx
git commit -m "feat: add the agent connect page"
```

### Task 18: Documentation and publish

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md`, `AGENTS.md`, `progress.md`

- [ ] **Step 1: README**

Add an "Agents and CLI" section: the four tools, the two commands, the `/agent` page, and the security note that the URL is the identity.

- [ ] **Step 2: Main spec**

Add a short "Agent access" section pointing at the new design doc and naming the one behavioural addition: `not_found` in `ActionErrorCode`. Do not restate the whole design.

- [ ] **Step 3: AGENTS.md**

Update the language rule from three places to four: the constraint, `ALLOWED_LANGS`, the grammars, and `agent/src/tools.ts`.

- [ ] **Step 4: progress.md**

Mark every phase done with what was verified, record the branch deviation, and set the next action to the merge.

- [ ] **Step 5: Publish**

```bash
bun run --cwd agent pack:dry
npm publish ./agent --access public   # owner's npm session required
```

If the publish is blocked, leave it as the only open item in `progress.md`; the package still works from a local path.

- [ ] **Step 6: Commit and merge**

```bash
git add README.md docs AGENTS.md progress.md
git commit -m "docs: record agent access"
git checkout main
git merge --no-ff feat/agent-access
```

---

## Verification Summary

| Phase | Ends when |
|---|---|
| 1 | The probe lists `ping` against a production `next start`, not just dev |
| 2 | `curl` posts a message that appears in the browser under a derived handle |
| 3 | The built `hitchat` binary sends and reads against a real room |
| 4 | A real agent calls `list_rooms` and `send_message` through stdio |
| 5 | The probe lists four tools against `next start`; ChatGPT/Claude verified or honestly recorded as unverified |
| 6 | `/agent` works in a browser, docs are updated, the package packs |

Every phase also runs `bun run test`, `bunx tsc --noEmit`, `bun run lint`, and `bun run build` before its final commit.

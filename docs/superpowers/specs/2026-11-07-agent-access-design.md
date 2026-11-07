# Agent Access — Design

**Date:** 2026-11-07
**Status:** Draft for owner approval
**Scope:** Let an AI agent or a human terminal post into a hitchat room as an ordinary
anonymous user.

This is a feature spec. The behaviour of the chat itself is unchanged. When this ships,
`docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md` gets a short section pointing
here, so the two never disagree.

---

## Why

hitchat can only be used through a browser today. That means a student has to copy code
out of their editor into a chat box by hand, and an AI assistant helping them in the
editor cannot see or answer in the lab room at all.

The owner wants the same thing `telegram-sendkit` provides: a local MCP server for coding
agents, a hosted MCP URL that ChatGPT or Claude web can add as a connector, and a command
line tool for humans. The difference is that hitchat has no login, so none of it may
require an account, OAuth, or an admin role.

---

## Goals

- An agent can list rooms, read recent messages, send text, and send code into any **unlocked** room.
- It posts as an anonymous handle, exactly like a student in the browser.
- Ban, lock, validation, and rate limits apply identically to web and agent writes.
- ChatGPT and Claude web can connect by pasting one URL, with no OAuth and no login.
- A human can do the same from a terminal with one command.
- Nothing new to deploy. Nothing new in the database.

## Non-goals

- Admin actions. No pin, lock, purge, ban, or SUDO badge. An agent cannot gain admin rights.
- Reactions, deletes, replies beyond a reply id, pinning, or typing indicators.
- Realtime streaming to the agent. Reads are a snapshot.
- OAuth, accounts, API key management, or per-key revocation.
- A second deployment, a second repository, or a second copy of the write path.

## Anti-goals — how we would know this failed even if it works

- `SUPABASE_SERVICE_ROLE_KEY` or `IDENTITY_PEPPER` appears anywhere outside the Next app.
- An agent request that carries a browser admin cookie gets the SUDO badge or the
  locked-room exemption.
- Rate limiting, ban checks, or validation are re-implemented in the CLI or MCP package.
- The chat's 8-hour promise stops holding for agent posts.

---

## What stays true

These are existing rules from the main spec and must not be relaxed:

- **One write path.** All writes go through the Next app with the service-role key. The
  publishable key stays `SELECT`-only.
- **Identity.** `sha256(token + IDENTITY_PEPPER)` produces the hash; name and colour are
  derived from it. Only the hash is stored.
- **Guard order.** ban → room lock → validation → rate limit → insert. The rate check
  records an event, so a post rejected for length must not consume quota.
- **Ephemerality.** Every message gets `expires_at = now() + 8 hours`, no exception.
- **Next 16.** Async `params`/`headers`, route handlers are uncached by default, and a
  route handler is the only place an HTTP write may land.

---

## Approaches considered

### A. In-app HTTP core, three thin front doors — **chosen**

One server-side service in `lib/agent/` owns room lookup, reads, and posts. The hosted MCP
route calls it directly. A small HTTP API exposes it. The CLI and the local MCP are two
published front doors that speak to that HTTP API.

- Cost: the tool descriptions exist twice (server route and local package).
- Win: one copy of every security rule, one deploy, no second secret, no extra URL for
  ChatGPT to reach, and each layer can be tested on its own with curl.

### B. Local MCP proxies to the hosted MCP endpoint

One tool definition, but every local call becomes MCP-over-HTTP-over-stdio. A transport
fault is invisible and hard to debug. Rejected as the default; it is still possible to add
later without changing anything else.

### C. Separate project, deployed on its own

Clean separation, but the hosted MCP can only reach hitchat two ways:

1. **Talk to Supabase directly** — puts the service key and pepper in a second deploy and
   copies the ban/lock/rate rules. This is the drift failure the repo already warns about.
2. **Proxy to hitchat's API** — owns no logic at all, and adds a deploy, a URL, and a hop
   to run code that only forwards.

Rejected. If the MCP later grows something that does not belong in a web app (OAuth,
other backends, long-lived streams), it moves out then — by that point the HTTP contract
below is the boundary, so the move is cheap.

---

## Design

### 1. The HTTP API

Four endpoints, all under `/api/agent`. They are the only surface the CLI and the local
MCP use. The hosted MCP route calls the same service functions directly, not over HTTP.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/agent/rooms` | Every room, as a readable path |
| `GET` | `/api/agent/messages?room=<path>&limit=<n>` | Recent messages, oldest first |
| `POST` | `/api/agent/messages` | Send text |
| `POST` | `/api/agent/code` | Send a code post |

**Auth.** Every request carries a token: `Authorization: Bearer <token>`, or
`x-hitchat-token: <token>`. It must be 16–128 characters of `A-Z a-z 0-9 _ -`; anything
else is `401`. The token is not checked against a store — it *becomes* the identity,
exactly as in the browser. Anyone can mint one; that is the product. On reads the token is
a format check only, not authorization; rooms are already public by URL.

**Room paths.** `cse/3/2/A`, matching the browser URL. Department slug and group label are
case-insensitive; year and batch must be integers. This is the only room identifier an
agent ever sees, so nothing has to guess a UUID.

**Request bodies.**

```jsonc
// POST /api/agent/messages
{ "room": "cse/3/2/A", "text": "hello", "reply_to_id": "optional-uuid" }

// POST /api/agent/code
{ "room": "cse/3/2/A", "code": "print(1)", "lang": "python",
  "title": "optional", "lab_tag": "Lab 3", "reply_to_id": "optional-uuid" }
```

`reply_to_id`, when present, must be a UUID for a live message in the same room. A bad one
is `invalid` rather than a database error five layers down.

**Responses.** The JSON body is the app's existing `ActionResult` shape, so one parser
serves every caller. `not_found` is added to `ActionErrorCode` for the room-miss case —
nothing in the browser UI produces it, but it is the honest code for it:

```jsonc
{ "ok": true,  "data": { "id": "...", "room": "cse/3/2/A", "url": "https://host/c/cse/3/2/A", "expires_at": "..." } }
{ "ok": false, "code": "rate_limited", "message": "You are posting too fast. Wait a moment.", "retryAfter": 7 }
```

The HTTP status mirrors the code, so a shell script can just look at the exit path:

| Code | Status | Meaning |
|---|---|---|
| `invalid` | 400 | Bad body, bad room path, or validation failed |
| `unauthorized` | 401 | No token |
| `banned` | 403 | This token is banned, message includes the expiry time |
| `locked` | 403 | Room is read-only |
| `not_found` | 404 | No such room |
| `rate_limited` | 429 | Includes `retryAfter` seconds and a `Retry-After` header |
| `server` | 500 | Unexpected |

**Read rules.** `GET /api/agent/messages` returns undeleted, unexpired messages, oldest
first, default 20 and max 50. Code bodies are cut at 8,000 characters with `"truncated":
true`, because fifty 50,000-character posts is more than any model will accept. Soft-deleted
and expired rows are simply absent — the browser's "message deleted" placeholder has no
meaning for an agent that never saw the message.

**New dependencies.** The app does not use Zod today. Phase 2 adds `zod`; phase 5 adds
`@modelcontextprotocol/server`. Both are server-only. If the MCP SDK pulls Node built-ins
that Turbopack tries to bundle, `serverExternalPackages` in `next.config.ts` is the lever.

### 2. Identity

The token is the identity. `hashToken` runs server-side, so the package and the CLI never
see the pepper. Two consequences, both intended:

- A user who copies their browser token into the CLI posts under their current handle and
  carries their current ban.
- An agent given a fresh UUID gets its own handle and its own clean quota.

Bans therefore work for free: a banned agent token is refused with the unban time, and a
new token is a new identity — the same trade-off the browser already makes when you press
"new identity".

### 3. The posting path

`lib/agent/post.ts` is a new function, deliberately **not** a call to `sendText` /
`postCode`:

1. `assertNotBanned(hash)`
2. `assertRoomOpen(groupId)` — no admin waiver, because agent requests have no admin
3. `validateText` / `validateCode`
4. `assertRateOk(hash, 'text' | 'code')`
5. `deriveHandle(hash)`
6. insert with `admin_id: null`

It never calls `currentAdminId()` and never reads cookies. This is the one place where a
mistake would hand out SUDO, so it gets a test that posts with an admin session cookie
attached and proves the row has no `admin_id`, plus a test that a locked room refuses even
with that cookie.

Rate limiting reuses the existing `text` and `code` buckets. **No migration is needed
anywhere in this feature.**

### 4. Room lookup

The query that turns `cse/3/2/A` into a group id already exists inline in the room page.
Extract it into `lib/rooms-server.ts` and have both the page and the agent service call it,
so they cannot drift:

```ts
findRoomByPath(dept, year, batch, group)
  => { id, label, isLocked, deptName } | null
```

The page keeps its exact 404 behaviour and drops its inline normalisation code.

`listRooms()` cannot reuse `getRoomTree()` — that select does not fetch `is_locked`. It gets
its own query on `departments → years → batches → groups`, selecting `label` and
`is_locked`, flattened to `{ path, dept, year, batch, group, locked }` and sorted the same
way the sidebar sorts.

### 5. Hosted MCP

`app/api/mcp/[token]/route.ts`, using `createMcpHandler` from `@modelcontextprotocol/server`
(the same SDK sendkit uses), with a server built per request and the token read from the
path — the same pattern as sendkit's `botTokenFromRequest`.

- Exports `GET`, `POST`, and `DELETE`, all forwarded to the handler.
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- A `Bearer` header wins over the path token when both are present.
- No OAuth discovery endpoints. Clients are configured with "no authentication"; the token
  in the URL is the identity.
- Stateless, JSON response mode. No sessions to clean up.

**ChatGPT / Claude web setup:** add a connector, paste
`https://<host>/api/mcp/<token>`, choose no auth. That is the whole setup.

**Risk, handled first:** sendkit's hosted MCP runs on Hono, not Next. Next route handlers
take a `Request` and return a `Response`, so the handler should drop in, but this is
unproven in this repo. Phase 1 proves it with one dummy tool before anything real is
built. If it fails, we fall back to approach C and lose one phase, not the design.

### 6. Local MCP

A separate published package, `@pranabkr/hitchat-agent`, with two binaries:

- `hitchat-mcp` — stdio MCP server, tools backed by the HTTP API.
- `hitchat` — the CLI below. `hitchat-agent` is an alias of the same file, so
  `npx @pranabkr/hitchat-agent` has something to resolve.

A package with more than one binary cannot be run by a bare `npx <package>` — npm refuses
to guess. Anything copied out of the docs therefore names both: `npx -y -p
@pranabkr/hitchat-agent hitchat …`, or `hitchat` / `hitchat-mcp` after `npm i -g`.

It lives in `agent/` at the repo root and is **not** a bun workspace member, so the Next
install and build are untouched. Three root files must learn to ignore it, or the repo's
own checks will fail on code that is not meant for them:

- `tsconfig.json` → `exclude` gains `agent`
- `eslint.config.mjs` → `globalIgnores` gains `agent/**`
- `vitest.config.ts` → `exclude` gains `agent/**` (its tests run with its own config)
- `.gitignore` → `agent/node_modules`, `agent/dist`

It has its own `package.json`, `tsconfig`, `tsdown` config, Vitest config and `bun test`
script, mirroring how sendkit builds its packages (`bin`, `dist`-only `files`,
`prepublishOnly`, `pack:dry`). Root `package.json` gains `agent:build` and `agent:test` so
the handoff is one command each.

It holds no secret. `HITCHAT_URL` and `HITCHAT_TOKEN` are its only inputs; both may come
from a config file or the environment. `init` defaults to the deployed site,
`https://chat.pranabkr.in`, so a first run is `npx @pranabkr/hitchat-agent init --new` with
no URL to type; `--url` and `HITCHAT_URL` win for anyone running their own copy, and the
`/agent` page fills in the host it is actually served from. *(Amended 2026-11-07: this
section originally said there was no hardcoded default host, because the deployed domain
was not settled. It is now, and asking for a URL that has exactly one right answer is
friction, not safety. The override is what keeps self-hosting honest.)*

One root test imports `agent/src/tools.ts` by relative path and pins the four tool names
against the hosted route, so the two surfaces cannot drift silently.

**Tools** — four, identical on the local and hosted servers:

| Tool | Input | Returns |
|---|---|---|
| `list_rooms` | none | `[{ path, dept, year, batch, group, locked }]` |
| `read_messages` | `room`, `limit?` (default 20, max 50) | recent messages, oldest first |
| `send_message` | `room`, `text`, `reply_to_id?` | `{ id, room, url, expires_at }` |
| `send_code` | `room`, `code`, `lang`, `title?`, `lab_tag?`, `reply_to_id?` | same |

Descriptions state the rules the model needs: paths come from `list_rooms`; text is 1,000
characters; code is 50,000; everything disappears in 8 hours; there are no admin actions.

### 7. CLI

```
hitchat init [--url <url>] [--token <token> | --new]
hitchat rooms
hitchat read <room> [--limit 20]
hitchat send <room> "<message>"
hitchat send <room> --code-file <path> --lang <lang> [--title <t>] [--lab <tag>]
```

`--url` defaults to `https://chat.pranabkr.in`.

- `init` writes `~/.config/hitchat/config.json` with `0600`, like sendkit's. `--new`
  generates a fresh UUID so the terminal gets its own identity, and the command then calls
  `/rooms` once to prove the URL and token actually work before writing the file.
  On Windows the mode is a no-op; the path is the same everywhere so the docs stay true.
- `HITCHAT_URL` / `HITCHAT_TOKEN` override the file, for CI and one-off use.
- Every command prints JSON, so it pipes. Errors print the server's message to stderr and
  exit `1`; usage errors exit `2`.
- `rooms` and `read` are read-only; `send` is the only writer.

### 8. Connect page `/agent`

A small page that makes the capability reachable without reading the source:

- The current browser token, with a copy button, plus `--new` guidance.
- The hosted MCP URL for that token.
- Copy-paste blocks: `claude mcp add` for the hosted URL, a `.mcp.json` (stdio) block and an
  `opencode.json` block, both pre-filled with the origin and the token the page is showing,
  ChatGPT/Claude web instructions, and the `npx -y -p … hitchat init` command.
- A plain warning: the URL is the identity; anyone holding it can post as that handle.

It is reachable from a quiet `agent access` link in the home page footer — one line, no new
nav, so the picker stays the first thing a student sees.

It uses only existing `design.md` tokens — no new colours, fonts, or components.

---

## What changes in the repo

| Path | Change |
|---|---|
| `lib/agent/token.ts` | Resolve a token from a header or path segment; reject malformed ones |
| `lib/agent/http.ts` | `ActionResult` → `Response`, with the status map above |
| `lib/agent/rooms.ts` | `listRooms()` and `findRoomByPath()` wrappers |
| `lib/agent/post.ts` | The only agent write path |
| `lib/agent/read.ts` | Snapshot read with limit clamping |
| `lib/agent/schemas.ts` | Zod input schemas |
| `lib/rooms-server.ts` | Shared room lookup extracted from the room page |
| `lib/result.ts` | Add the `not_found` code |
| `app/c/[dept]/[year]/[batch]/[group]/page.tsx` | Call the extracted lookup |
| `app/api/agent/{rooms,messages,code}/route.ts` | The HTTP API |
| `app/api/mcp/[token]/route.ts` | Hosted MCP |
| `app/agent/page.tsx`, `components/agent/connect-panel.tsx` | Connect page |
| `agent/` | Published package: CLI + local MCP |
| `package.json`, `next.config.ts` | `zod`, `@modelcontextprotocol/server`, `serverExternalPackages` if needed, `agent:*` scripts |
| `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore` | Exclude `agent/` from the app's checks and from git |
| `tests/agent-*.test.ts`, `tests/agent-tools.test.ts` | API, guards, identity, cross-surface tool names |
| `README.md`, main spec, `AGENTS.md` | Docs, the new language-list place, progress |

The room page changes only to call the extracted lookup.

---

## Security notes

- **The URL token is the identity, not a password.** It is normally a UUID, so it cannot be
  guessed, but whoever sees the URL can post as that handle until the 8-hour history
  expires. The page says this out loud. There is nothing to leak beyond the handle itself.
- **No secret in the package.** Neither binary ever sees the service key or the pepper.
- **No cookie trust.** The agent path never reads the admin session, so a curl with a
  valid admin cookie behaves exactly like a student.
- **Rotating tokens resets quota.** A determined spammer can mint a new UUID for a fresh
  identity. The browser already allows this; the agent feature does not make it worse.
  Per-IP limiting would need a new table and is out of scope.
- **Reads are public by design.** Any room's messages are already readable by URL, so
  `read_messages` exposes nothing new.

---

## Things that could go wrong

| Risk | Response |
|---|---|
| `createMcpHandler` misbehaves in a Next route | Phase 1 proves it with a dummy tool; fall back to a separate Hono app (approach C) |
| Tool descriptions drift between local and hosted | Both call the same HTTP API; a test pins the schema list in both places |
| A new language is added | Now **four** places: constraint, `ALLOWED_LANGS`, grammar imports, package schema. `AGENTS.md` is updated in the same phase |
| Agent posts flood a room | Same 5/10s and 10/60s buckets; `Retry-After` is returned |
| ChatGPT rejects the connector | Token-in-path with no auth is the most permissive setup; verify after the app is deployed |

---

## Build phases

Each phase is one branch, one `progress.md` entry written before the work, and ends
verified — not just compiling. Detailed steps come in the plan.

1. **Prove the MCP pipe.** One dummy tool in a Next route handler, called by a real MCP
   client. Decides the transport before any product code exists.
2. **Agent core and HTTP API.** Token, room lookup, read, text post, code post, guards,
   error mapping, tests. Ends usable with `curl`.
3. **CLI.** `agent/` package with the `hitchat` binary; real commands against a real room.
4. **Local MCP.** `hitchat-mcp` stdio over the same API; driven by a real agent, verified
   in the browser.
5. **Hosted MCP.** `/api/mcp/[token]` with the same four tools; verified locally, then
   from ChatGPT/Claude once the app is reachable.
6. **Connect page, docs, publish.** `/agent`, README, spec and `AGENTS.md` updates, npm
   publish, `progress.md` handoff.

Phase 1 is a gate. Everything after it assumes the answer was "yes, it works in Next".

---

## How each phase is verified

Following `AGENTS.md` — a green suite is not enough:

- **Guards proven by breaking them.** Remove the ban check, the lock check, or the
  `admin_id: null` line and confirm the specific test fails.
- **Drive the capability, not just the function.** Every phase is exercised through the
  surface it adds: curl for the API, the real binary for the CLI, a real MCP client for
  each server, a browser for `/agent`.
- **The database is live.** Tests use per-run token suffixes and sweep their own rows.
- **Browser checks assert HTTP status,** and never target a mutating list with
  `.first()`/`.last()`.

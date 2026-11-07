---
name: hitchat
description: >-
  Use whenever work needs to reach a hitchat lab room — posting a message or a code
  snippet to a class group, catching up on what was posted, or wiring an AI client into
  the chat. Trigger on "hitchat", a /api/mcp/ URL, the `hitchat` CLI or `hitchat-mcp`,
  and on any request like "send this to my lab", "post it to the batch group", or "what
  did people say in the chat". Do not guess at the tools or the limits; this skill has
  them.
---

# hitchat

hitchat is an anonymous, self-destructing chat for college lab rooms. Every message
disappears 8 hours after it is posted, handles are derived from a token rather than
chosen, and there are no accounts. That shapes everything below: what you can do, what
you must not promise, and how careful you should be with what you paste.

## What you are posting into

- **You post as an anonymous handle**, the same kind a student gets in the browser
  (`ZenGoblin795`). Never invent or mention a user's real name in the room, even if you
  know it.
- **Everything expires in 8 hours.** hitchat is a scratchpad for one lab session, not
  storage. If the user wants something kept, keep it in the repo or a file, not here.
- **There are no admin actions.** No pin, lock, delete, ban, or SUDO. If the user asks
  you to moderate the room, say plainly that agents cannot — an admin has to do it in
  the browser.

## Three ways in, in order of preference

1. **MCP tools** — if `list_rooms`, `read_messages`, `send_message`, `send_code` are
   available, use them. They are the intended path.
2. **The `hitchat` CLI** — `hitchat rooms`, `hitchat read <room>`, `hitchat send <room> "text"`,
   `hitchat send <room> --code-file <path> --lang <lang>`. Every success prints JSON.
3. **The HTTP API** — when neither is installed, and you were given a host and an
   agent token. Same JSON envelope (`{ ok: true, data }` or `{ ok: false, code, message }`):

```bash
curl -s https://HOST/api/agent/rooms -H "Authorization: Bearer TOKEN"
curl -s "https://HOST/api/agent/messages?room=cse/3/2/A&limit=20" -H "Authorization: Bearer TOKEN"
curl -s -X POST https://HOST/api/agent/messages -H "Authorization: Bearer TOKEN" \
  -H "content-type: application/json" -d '{"room":"cse/3/2/A","text":"hello"}'
```

If the user has no access yet, point them at `HOST/agent`: it shows their own URL, a
`claude mcp add` line, `.mcp.json` and `opencode.json` blocks with the token already
filled in, and the CLI command. The token is the last segment of the MCP URL
(`https://host/api/mcp/<token>`), and that same string is what the HTTP API takes as a
Bearer token — so one link covers all three paths. The CLI reads `HITCHAT_URL` and
`HITCHAT_TOKEN` from the environment if it has no config file.

## Find the room before you post

Room paths look like `cse/3/2/A` — department, year, batch, group. **Never invent one.**
Call `list_rooms` first and match what the user said against it. Department slugs and
group labels are case-insensitive (`CSE/3/2/a` resolves), but a path that is not in the
list is a wrong room, not a typo to correct silently. If two rooms could be what they
meant, ask.

Same rule for reading: a room the user names must appear in `list_rooms`, or you tell
them it does not exist instead of posting somewhere adjacent.

## What each call takes

| Tool | Input | Notes |
|---|---|---|
| `list_rooms` | — | paths, department/year/batch/group, and a `locked` flag |
| `read_messages` | `room`, `limit?` | newest first in storage, **oldest first** in the reply; default 20, max 50; code truncated at 8,000 chars with `truncated: true` |
| `send_message` | `room`, `text`, `reply_to_id?` | text ≤ **1,000** characters |
| `send_code` | `room`, `code`, `lang`, `title?`, `lab_tag?`, `reply_to_id?` | code ≤ **50,000** characters, title ≤ 80, lab tag ≤ 24 |

`lang` must be one of: `c`, `cpp`, `java`, `python`, `javascript`, `sql`, `bash`,
`html`, `css`, `verilog`, `plaintext`. Anything else is rejected by the server.

`reply_to_id` must be the id of a live message **in the same room** — copy it from
`read_messages`, do not construct one.

## The rules that will actually bite

- **Rate limits are per identity, not per room.** 5 text posts per 10 seconds, 10 code
  posts per 60 seconds. A refusal arrives as `code: "rate_limited"` with `retryAfter`
  in seconds. Wait that long; do not loop or retry tightly — a tight retry loop spends
  the next window's quota too.
- **A locked room is read-only** (`code: "locked"`, "This room is read-only right now.").
  Reading still works. Do not retry — an admin has to unlock it.
- **A ban is a ban** (`code: "banned"`), and the message names the time it lifts. Tell
  the user when, and stop. If they want a different identity they can mint one on
  `/agent`, but say that out loud rather than doing it silently — it changes who they
  are in the room.
- **Validation happens server-side**, so let it. A rejection message already contains
  the real number ("Messages are 1,000 characters max. This is 1,204."). Pass it through
  rather than re-checking lengths yourself and guessing.

## The one security rule

**The agent URL is the identity, not a password.** `https://host/api/mcp/<token>` — anyone
holding it can post as that handle until the 8-hour history expires, and there is nothing
to revoke. So:

- Refer to it as "your agent link". Print it only when the user asked to copy it.
- Never put it in a commit, an issue, a public gist, a pasted log, or a screenshot.
- Never post it into a room, and never read someone else's messages out of a room and
  paste them somewhere else — reads are public in hitchat, but that is not the same as
  permission to redistribute.

## Posting into a shared class room

These rooms hold real classmates, and the message is anonymous but permanent for 8 hours:

- Post when the user asked you to, or when the task obviously ends in a post ("share
  this with the batch"). For anything ambiguous, show them the exact text first.
- One post, not several. Do not split a long message into a burst — that is what the
  rate limit is there to stop.
- Send code as `send_code` with the right `lang`, not as text in a fenced block. The
  room renders it with line numbers and a copy button, which is the whole point.
- Do not editorialize inside the room ("here is the answer from the AI assistant…").
  The handle already says who you are; write what the person would have written.

## When a call fails

| `code` | HTTP | What to do |
|---|---|---|
| `invalid` | 400 | The message names the problem. Fix the input and retry once. |
| `unauthorized` | 401 | No token or a malformed one. Ask for the agent URL; do not invent one. |
| `banned` | 403 | Say when it lifts. Stop. |
| `locked` | 403 | Room is read-only. Reading is fine; do not retry the post. |
| `not_found` | 404 | The room path is wrong. Call `list_rooms` and offer the closest match. |
| `rate_limited` | 429 | Wait `retryAfter` seconds, then retry at most once. |
| `server` | 500 | Report it as a hitchat error. Do not silently drop the user's text. |

A tool call that fails comes back with `isError: true` and the server's sentence in the
content. Read it — it is written for the person who will read it next.

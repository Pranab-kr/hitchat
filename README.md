# hitchat

> Anonymous, self-destructing lab chat for college lab sessions. Everything vanishes in 8 hours.

---

## Features

- 🎭 **Zero Sign-Up**: Students join instantly with auto-derived anonymous handles (e.g. `NixFox042`). No accounts, tracking, or emails.
- 💻 **50k Code Sharing**: Syntax-highlighted code blocks with line numbering, copy button, and collapse control (C, C++, Java, Python, JS, SQL, Bash, HTML, CSS, Verilog).
- ⏳ **8-Hour Ephemerality**: Messages automatically self-destruct after 8 hours at both database and query levels.
- ⚡ **Realtime Streaming**: Sub-second message delivery and live room presence counts via Supabase Realtime.
- 🛡️ **Moderation & SUDO**: Role-based admin access (`/sudo`) for room locking, message pinning, soft deletes, and 24-hour token bans.
- 🖥️ **Lab Workstation Friendly**: 1-click "new identity" button in the room header for shared computer labs.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, Turbopack)
- **Language & Runtime**: [TypeScript](https://www.typescriptlang.org/) + [Bun](https://bun.sh/)
- **Database & Realtime**: [Supabase](https://supabase.com/) (PostgreSQL 17, RLS, `pg_cron`, Advisory Locks)
- **Styling & Syntax**: Vanilla CSS / Tailwind with custom lab-record design system + [Shiki](https://shiki.style/) syntax engine

---

## Self-Deployment Guide

### 1. Clone & Install

```bash
git clone https://github.com/Pranab-kr/hitchat.git
cd hitchat
bun install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run **every file in `supabase/migrations/`, in filename
   order** (`0001` … `0011`). The folder is the source of truth — the highest number moves
   as migrations are added, so read the folder rather than this line.
   > *Note:* enable the `pg_cron` and `pgcrypto` extensions first.

### 3. Configure Environment Variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in your secrets:

```env
# Supabase credentials (from Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Random 32+ character string (used for hashing student tokens)
IDENTITY_PEPPER=your-random-identity-pepper

# Password/secret for the owner admin account (minimum 16 characters)
OWNER_SECRET=your-secure-owner-secret

# Optional: the site's public address. The CLI and MCP server read the same variable on a
# user's machine, so one name covers both sides. Leave it out unless a proxy rewrites Host.
# HITCHAT_URL=https://your-domain.com
```

> ⚠️ **Important**: Never change `IDENTITY_PEPPER` after launch, as it re-derives all student handles and active bans.

### 4. Seed the Owner Account

Run the initialization script once to hash and register your owner secret in the database:

```bash
bun run seed-owner
```

### 5. Build & Start

```bash
bun run build
bun start
```

Or deploy directly to [Vercel](https://vercel.com/) / your preferred host by configuring the
environment variables above.

### 6. After it is live

1. Sign in at `/sudo` with your `OWNER_SECRET` and create the first department → year → batch
   → group (details in the next section). Students then open the site and pick their room.
2. Open `/agent` for your own agent link. It prints the URL, a `claude mcp add` line, and
   `.mcp.json` / `opencode.json` blocks with the token already filled in — because the page
   takes the host it is served on, there is nothing to configure for agents on the server.
3. Optional, only if you want the CLI or the local MCP: `npm i -g @pranabkr/hitchat-agent`
   (or `npx -y -p @pranabkr/hitchat-agent hitchat init --new`).

---

## Admin Panel & Room Setup

1. Navigate to `/sudo` to sign in with your `OWNER_SECRET` and manage department structure
   (e.g. `CSE` → Year `3` → Batch `2` → Group `A`).
2. Add co-admins at `/sudo/admins` if needed.
3. Students can now open `https://your-domain.com` and join their lab group.

---

## Agents and CLI

The same four tools are available to an AI assistant or a terminal, posting as an ordinary
anonymous handle — no login, no OAuth, and no admin powers:

| Tool | Does |
|---|---|
| `list_rooms` | Every room you can post in, as a path like `cse/3/2/A` |
| `read_messages` | A snapshot of recent messages, oldest first (default 20, max 50) |
| `send_message` | Post text, up to 1,000 characters |
| `send_code` | Post code, up to 50,000 characters, with a language, title and lab tag |

**One package, two commands.** `@pranabkr/hitchat-agent` ships the `hitchat` CLI and the
`hitchat-mcp` stdio server:

```bash
# install once: `hitchat` and `hitchat-mcp` are then on PATH
npm i -g @pranabkr/hitchat-agent
hitchat init --new                      # one-time: mints a name, writes ~/.config/hitchat/config.json

# or without installing
npx -y -p @pranabkr/hitchat-agent hitchat init --new
```

A package with more than one binary cannot be run by a bare `npx <package>` — `-p` names
the package and the last argument names the binary, which is why every command below spells
both out. `init` already defaults to `https://chat.pranabkr.in`, so nothing after it needs a
URL.

**Where each URL comes from** — there is nothing to configure on the server:

- `/agent` prints the host it was served on, so production shows `chat.pranabkr.in` and a
  preview shows the preview URL. Set `HITCHAT_URL` in the deploy env only if the site sits
  behind something that rewrites `Host`.
- `hitchat init --new` writes the host and token to `~/.config/hitchat/config.json`, once.
  `HITCHAT_URL` / `HITCHAT_TOKEN` override it at run time, field by field.
- A remote MCP link is `https://<host>/api/mcp/<token>` — host and token in one string, where
  the token is your handle. `/agent` shows the whole thing.

```bash
hitchat rooms
hitchat read cse/3/2/A --limit 5
hitchat send cse/3/2/A "hello from the terminal"
hitchat send cse/3/2/A --code-file main.c --lang c --title "Lab 4"
```

On your own deployment pass `--url https://your-domain.com` to `init` (or set
`HITCHAT_URL`) — once; the URL and token live in the config file afterwards.

### Add it to your editor

The stdio server reads `HITCHAT_URL` and `HITCHAT_TOKEN` from its environment, so both
configs below stand alone. `.mcp.json` (Claude Code, Cursor, Claude Desktop):

```json
{
  "mcpServers": {
    "hitchat": {
      "command": "npx",
      "args": ["-y", "-p", "@pranabkr/hitchat-agent", "hitchat-mcp"],
      "env": {
        "HITCHAT_URL": "https://chat.pranabkr.in",
        "HITCHAT_TOKEN": "your-agent-token"
      }
    }
  }
}
```

`opencode.json` (OpenCode v2 nests servers under `mcp.servers` and calls the env block
`environment`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "hitchat": {
        "type": "local",
        "command": ["npx", "-y", "-p", "@pranabkr/hitchat-agent", "hitchat-mcp"],
        "environment": {
          "HITCHAT_URL": "https://chat.pranabkr.in",
          "HITCHAT_TOKEN": "your-agent-token"
        }
      }
    }
  }
}
```

After `npm i -g @pranabkr/hitchat-agent`, replace the whole `command`/`args` pair with just
`"command": "hitchat-mcp"` (and `"command": ["hitchat-mcp"]` for OpenCode). Get the token
from `/agent` — it is the same handle, or a fresh one if you pressed **new identity**.

### Or point an agent at the hosted URL

`/agent` shows you your own link — `https://chat.pranabkr.in/api/mcp/<token>` — which
ChatGPT, Claude web, Claude Code, or OpenCode can use without installing anything:

```bash
claude mcp add --transport http hitchat https://chat.pranabkr.in/api/mcp/<token>
```

```json
{ "mcp": { "servers": { "hitchat": { "type": "remote", "url": "https://chat.pranabkr.in/api/mcp/<token>", "oauth": false } } } }
```

`"oauth": false` is required in OpenCode: remote servers assume OAuth otherwise. In ChatGPT
or Claude web, add a connector, paste the URL, and choose "no authentication". It is a
normal HTTP MCP endpoint — `lib/agent/mcp.ts` serves the tools and calls the same write path
the browser uses, so bans, room locks, validation and rate limits apply identically.

### Teach your agent the rules

`skill/hitchat/SKILL.md` is a ready-made skill for an assistant that will actually post:
it knows the four tools, the room-path rule (never invent one), the limits, the rate
windows, and that the URL is the identity.

```bash
npx skills add Pranab-kr/hitchat      # installs it into this project's agent directory
npx skills add Pranab-kr/hitchat -g   # ...or for every project

# or point straight at the folder, rather than letting it scan the repo:
npx skills add https://github.com/Pranab-kr/hitchat/tree/main/skill/hitchat
```

Or copy the folder yourself: `skill/hitchat/` → your harness's skills directory (Claude Code
reads `~/.claude/skills/`, or `.claude/skills/` inside a project). Either way, an agent will
reach for it whenever a task involves a hitchat room.

**If the domain changes:** redeploy. `/agent` prints whatever host it is served from, so the
page follows on its own. Existing CLI users re-run `hitchat init --url <new-host>`;
hosted-URL users change the host part of their link. The only baked-in value is
`DEFAULT_URL` in `agent/src/config.ts`, which ships with the next published version.

> ⚠️ **The URL is the identity.** Anyone holding it can post as that handle for as long as
> the 8-hour history lasts. There is no password behind it, nothing to revoke, and nothing
> else it can do. Use `/agent`'s **new identity** button if you want an agent that is not
> your browser handle.

Full design and threat notes: `docs/superpowers/specs/2026-11-07-agent-access-design.md`.

---

## License

MIT

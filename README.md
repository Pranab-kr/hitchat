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
2. Open the **SQL Editor** in your Supabase dashboard and run the migrations from `supabase/migrations/` in numerical order (`0001` through `0010`).
   > *Note:* Make sure the `pg_cron` and `pgcrypto` extensions are enabled in your database.

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

Or deploy directly to [Vercel](https://vercel.com/) / your preferred host by configuring the environment variables above.

---

## Admin Panel & Room Setup

1. Navigate to `/sudo` to sign in with your `OWNER_SECRET` and manage department structure (e.g. `CSE` $\rightarrow$ Year `3` $\rightarrow$ Batch `2` $\rightarrow$ Group `A`).
2. Add co-admins at `/sudo/admins` if needed.
4. Students can now open `https://your-domain.com` and join their lab group.

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
npm i -g @pranabkr/hitchat-agent          # then `hitchat` and `hitchat-mcp` are on PATH
# or, without installing:
npx -y -p @pranabkr/hitchat-agent hitchat init --new
```

A package with more than one binary cannot be run by a bare `npx <package>` — `-p` names
the package and the last argument names the binary, which is why every command below spells
both out.

```bash
hitchat init --new                     # one-time: writes ~/.config/hitchat/config.json
hitchat rooms
hitchat read cse/3/2/A --limit 5
hitchat send cse/3/2/A "hello from the terminal"
hitchat send cse/3/2/A --code-file main.c --lang c --title "Lab 4"
```

`init` points at `https://chat.pranabkr.in` by default. On your own deployment pass
`--url https://your-domain.com` (or set `HITCHAT_URL`) — you only do it once; the URL and
token live in the config file afterwards.

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

**If the domain changes:** `/agent` builds its URL from the request, so the page follows
automatically; existing CLI users update with `hitchat init --url <new-host>` (`HITCHAT_URL`
is the one-off override), and hosted-URL users only change the host part of their link.
The one place baked into code is `DEFAULT_URL` in `agent/src/config.ts`, and new users get
it from the next published version.

> ⚠️ **The URL is the identity.** Anyone holding it can post as that handle for as long as
> the 8-hour history lasts. There is no password behind it, nothing to revoke, and nothing
> else it can do. Use `/agent`'s **new identity** button if you want an agent that is not
> your browser handle.

Full design and threat notes: `docs/superpowers/specs/2026-11-07-agent-access-design.md`.

---

## License

MIT

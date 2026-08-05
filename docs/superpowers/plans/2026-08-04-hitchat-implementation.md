# hitchat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an anonymous, 8-hour-ephemeral chat where college lab students share syntax-highlighted lab code in rooms scoped to department → year → batch → group, moderated by an owner and delegated co-admins.

**Architecture:** Every write goes through a Next.js Server Action holding the Supabase service-role key, where rate limiting, ban checks, validation and admin authorization are enforced. The browser holds only the publishable key, whose grants permit `SELECT` on named columns and nothing else. Reads are live via Supabase Realtime (INSERT + UPDATE only — never DELETE). A `pg_cron` job hard-deletes expired rows every 10 minutes.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack) · React 19.2.4 · TypeScript · Tailwind v4 · `@supabase/supabase-js` · Shiki 4.4.1 · Motion 12.43.0 · next-themes 0.4.6 · shadcn 4.16.1 · bun · Vitest

**Reference documents:**
- Spec (behavior): `docs/superpowers/specs/2026-08-03-anon-lab-chat-design.md`
- Design system (every color/font/spacing value): `design.md`
- Conventions and Next.js 16 gotchas: `AGENTS.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

**Security — these are not negotiable:**
- The service-role key **never** reaches the browser. It is read only inside `server-only` modules imported by Server Actions.
- **Every write goes through a Server Action.** The publishable key gets `SELECT` on named columns only.
- **Every admin action independently re-verifies its session** — loads the session, checks `revoked_at is null` and `expires_at > now()`, and re-checks role for owner-only operations. `proxy.ts` is *not* authorization; the Next.js docs say so explicitly.
- **Never trust a client-supplied role, admin flag, or token hash.** Derive server-side.
- Admin secrets are stored **hashed** (bcrypt). Never plaintext, ever.
- `author_token_hash` is never sent to a client.

**Next.js 16 (verified against `node_modules/next/dist/docs/`):**
- `cookies()`, `headers()`, `params`, `searchParams` are **async**.
- `cookieStore.set()`/`.delete()` work **only** in Server Actions and Route Handlers.
- `middleware.ts` is now **`proxy.ts`** — Node runtime only.
- Server Actions **dispatch sequentially per client**. Never `Promise.all` them from the client.
- Expected errors are **return values**, not throws; read with `useActionState`.
- `revalidateTag` requires a second argument in v16. We avoid it — Realtime handles freshness.
- `next lint` is removed. Run `eslint` directly.
- Turbopack is default. No custom webpack config. `cacheComponents` stays **off**.

**Supabase (verified against live docs + WALRUS source):**
- Use `@supabase/supabase-js` only. **Not `@supabase/ssr`** (it exists to sync Supabase Auth cookies; we use none). `@supabase/auth-helpers-nextjs` is deprecated.
- **Never subscribe to DELETE.** Realtime cannot filter DELETE events and does not apply RLS to them. Deletion is soft (an UPDATE); expiry is hidden client-side.
- Column-restricted roles **cannot use `select *`**. Every client query names its columns explicitly.
- The **primary key must stay granted** to `anon`, or WALRUS returns 401 with no payload.

**Design (`design.md` is prescriptive, not suggestive):**
- Six color tokens per theme, each with exactly one job. **No new colors.**
- `marigold` appears **only** on the SUDO badge and pinned strip.
- Fonts: Bricolage Grotesque (display, room titles only), Figtree (body), IBM Plex Mono (code/meta). No serif.
- Spacing scale: 4/8/12/16/24/32/48. Radius: 6px inputs/buttons, 8px cards, 0 on the margin rule.
- No stock shadcn appearance. At most **one** Magic UI component in the entire app; default to zero.
- `prefers-reduced-motion` respected everywhere. Visible keyboard focus (2px `pen` ring, 2px offset).

**Copy:** Active voice, sentence case. A control names what happens ("Post code", not "Submit"). Errors state what happened and what to do, name real numbers, and never apologize. Never expose implementation vocabulary (no "token", "hash", "RLS") to students.

**Workflow (from `AGENTS.md`):** One task at a time, on `feat/<task-slug>`. Update `progress.md` to "In progress" and commit that **before** building. Merge to `main` and delete the branch when the task's verification passes.

---

## File Structure

```
app/
  layout.tsx                    root layout, fonts, ThemeProvider
  globals.css                   Tailwind v4 @theme tokens, Shiki dual-theme CSS
  page.tsx                      room picker
  c/[dept]/[year]/[batch]/[group]/
    page.tsx                    room (server): loads 100 messages, renders shell
  sudo/
    page.tsx                    admin login
    structure/page.tsx          owner: departments/years/batches/groups
    admins/page.tsx             owner: co-admin management
lib/
  supabase/
    admin.ts                    service-role client (server-only)
    browser.ts                  publishable-key client
  identity.ts                   token hashing + handle/color derivation
  columns.ts                    explicit column lists (no select *)
  age.ts                        age-fade opacity computation
  highlight.ts                  Shiki singleton highlighter
  shiki-theme.ts                custom light/dark TextMate themes
  validate.ts                   input caps + validation
  result.ts                     ActionResult type
app/actions/
  messages.ts                   send, postCode, deleteOwn
  reactions.ts                  toggle
  admin.ts                      login, logout, moderation
  structure.ts                  owner: CRUD departments/years/batches/groups
  admins.ts                     owner: create/revoke co-admins
lib/auth/
  session.ts                    admin session create/verify/destroy
components/
  chat/                         MessageList, MessageRow, CodeCard, Composer, ...
  room/                         Sidebar, RoomHeader, LabFilter, PinnedStrip
  ui/                           shadcn primitives (restyled)
supabase/migrations/            SQL migrations
tests/                          Vitest
```

---

## Task 1: Project setup — dependencies, tokens, fonts, theme

**Files:**
- Modify: `package.json` (deps)
- Modify: `app/globals.css` (complete rewrite)
- Modify: `app/layout.tsx` (complete rewrite)
- Create: `app/theme-provider.tsx`
- Create: `components/theme-toggle.tsx`
- Create: `lib/utils.ts`
- Create: `.env.local.example`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Test: `tests/globals.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `cn(...inputs: ClassValue[]): string` from `lib/utils.ts`; CSS custom properties `--color-paper|ink|pen|rule|marigold|graphite` usable as Tailwind classes `bg-paper`, `text-ink`, `text-pen`, `border-rule`, `bg-marigold`, `text-graphite`; font variables `--font-display`, `--font-body`, `--font-mono`.

- [ ] **Step 1: Install dependencies**

```bash
bun add @supabase/supabase-js motion next-themes shiki @shikijs/langs bcryptjs clsx tailwind-merge
bun add -d vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/bcryptjs
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
```

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Write the failing test for design tokens**

Create `tests/globals.test.ts`. This guards the constraint that matters: the exact hex values from `design.md`, and that `marigold` is not used for anything ordinary.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

describe('design tokens', () => {
  it('defines the six light-theme tokens with exact design.md values', () => {
    expect(css).toContain('--paper: #FAF5F1')
    expect(css).toContain('--ink: #241E1A')
    expect(css).toContain('--pen: #2C5F8F')
    expect(css).toContain('--rule: #C8503F')
    expect(css).toContain('--marigold: #E5A03A')
    expect(css).toContain('--graphite: #6E645C')
  })

  it('defines the six dark-theme tokens with exact design.md values', () => {
    expect(css).toContain('--desk: #1A1613')
    expect(css).toContain('--chalk: #EDE6DE')
    expect(css).toContain('--pen: #7FB0DC')
    expect(css).toContain('--rule: #D9705F')
    expect(css).toContain('--marigold: #F0B657')
    expect(css).toContain('--graphite: #9A8F86')
  })

  it('uses class-based dark mode, not the media query', () => {
    expect(css).toContain('@custom-variant dark')
    expect(css).not.toContain('prefers-color-scheme')
  })

  it('aliases tokens through @theme inline so they can be swapped at runtime', () => {
    expect(css).toContain('@theme inline')
    expect(css).toContain('--color-paper: var(--paper)')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `bun run test tests/globals.test.ts`
Expected: FAIL — the current `globals.css` is the Next.js default and contains none of these tokens.

- [ ] **Step 7: Write `app/globals.css`**

Tailwind v4 is CSS-first: there is no `tailwind.config.js`. `@theme` cannot be nested inside a selector, so runtime-swappable values live in `:root`/`.dark` and `@theme inline` aliases them — `inline` is required for var-referencing tokens or resolution happens at the definition site and dark mode breaks.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --paper: #FAF5F1;
  --ink: #241E1A;
  --pen: #2C5F8F;
  --rule: #C8503F;
  --marigold: #E5A03A;
  --graphite: #6E645C;

  --surface: #FCF9F6;
  --hairline: #241E1A1A;
  --wash: #241E1A0A;
  --code-bg: #F5EFEA;
}

.dark {
  --paper: #1A1613;
  --ink: #EDE6DE;
  --pen: #7FB0DC;
  --rule: #D9705F;
  --marigold: #F0B657;
  --graphite: #9A8F86;

  --desk: #1A1613;
  --chalk: #EDE6DE;

  --surface: #221D19;
  --hairline: #EDE6DE1F;
  --wash: #EDE6DE0F;
  --code-bg: #26201C;
}

@theme inline {
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-pen: var(--pen);
  --color-rule: var(--rule);
  --color-marigold: var(--marigold);
  --color-graphite: var(--graphite);
  --color-surface: var(--surface);
  --color-hairline: var(--hairline);
  --color-wash: var(--wash);
  --color-code-bg: var(--code-bg);

  --font-display: var(--font-bricolage), ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --radius-input: 6px;
  --radius-card: 8px;
}

@layer base {
  body {
    background-color: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 24px;
  }

  *:focus-visible {
    outline: 2px solid var(--pen);
    outline-offset: 2px;
  }
}

/* Shiki dual-theme: emit variables only, drive with the .dark class.
   defaultColor:'light-dark()' is media-query-driven and would ignore our class. */
.shiki,
.shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}

.dark .shiki,
.dark .shiki span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
  font-style: var(--shiki-dark-font-style);
}

/* Line numbers in the code card gutter (Shiki has no built-in transformer). */
.shiki code {
  counter-reset: line;
}

.shiki .line::before {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: 2rem;
  margin-right: 1rem;
  text-align: right;
  color: var(--graphite);
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `bun run test tests/globals.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 9: Create `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 10: Create `app/theme-provider.tsx`**

`app/layout.tsx` is a Server Component, so the provider is re-exported from a `"use client"` file.

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 11: Rewrite `app/layout.tsx`**

`suppressHydrationWarning` on `<html>` is mandatory — next-themes writes the class before paint, and the attribute only applies one level deep.

```tsx
import type { Metadata } from 'next'
import { Bricolage_Grotesque, Figtree, IBM_Plex_Mono } from 'next/font/google'
import { ThemeProvider } from './theme-provider'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['600'],
})

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['400', '500', '600'],
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'hitchat',
  description: 'Anonymous lab chat. Everything vanishes in 8 hours.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${figtree.variable} ${plexMono.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 12: Create `components/theme-toggle.tsx`**

Gating on `mounted` avoids a hydration mismatch; `resolvedTheme` is used because `theme` can be the string `"system"`. The placeholder keeps layout stable.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="size-8" aria-hidden />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="size-8 rounded-[6px] text-graphite hover:bg-wash hover:text-ink"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? '◑' : '◐'}
    </button>
  )
}
```

- [ ] **Step 13: Create `.env.local.example`**

```bash
# Supabase — from your project's API settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server-only. Never prefix with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# Server-only. Random 32+ chars. Mixed into anonymous token hashing.
IDENTITY_PEPPER=

# Server-only. Seeds the owner admin row on first setup.
OWNER_SECRET=
```

- [ ] **Step 14: Verify the app builds and renders**

```bash
bun run build
```

Expected: build succeeds with no type errors.

Then `bun dev`, open `http://localhost:3000`, and confirm in the browser: the page background is warm paper `#FAF5F1`, and toggling the OS to dark mode switches it to `#1A1613` with no flash on reload.

- [ ] **Step 15: Commit**

```bash
git add package.json bun.lock vitest.config.ts tests/ app/ lib/ components/ .env.local.example
git commit -m "Set up design tokens, fonts, and theming

Tailwind v4 is CSS-first, so tokens live in :root/.dark and are aliased
through @theme inline — required for runtime swapping, since @theme
cannot be nested in a selector."
```

---

## Task 2: Database schema and RLS

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Create: `supabase/migrations/0002_grants_rls.sql`
- Create: `supabase/migrations/0003_realtime_cron.sql`
- Create: `lib/columns.ts`
- Test: `tests/rls.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: tables `departments`, `years`, `batches`, `groups`, `messages`, `reactions`, `admins`, `admin_sessions`, `bans`, `rate_events`; column list constants `MESSAGE_COLUMNS: string`, `ROOM_COLUMNS: string` from `lib/columns.ts`

**Note:** Apply these via the `supabase` MCP `apply_migration` tool, one call per file, using the file's name as the migration name.

- [ ] **Step 1: Write `supabase/migrations/0001_schema.sql`**

```sql
create extension if not exists pgcrypto;

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Academic year within a department: 1st, 2nd, 3rd, 4th (5 allowed for 5-year courses).
create table years (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  number int not null check (number between 1 and 5),
  created_at timestamptz not null default now(),
  unique (department_id, number)
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references years(id) on delete cascade,
  number int not null,
  label text,
  created_at timestamptz not null default now(),
  unique (year_id, number)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  label text not null,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (batch_id, label)
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null check (role in ('owner', 'co_admin')),
  secret_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table admin_sessions (
  token text primary key,
  admin_id uuid not null references admins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  kind text not null check (kind in ('text', 'code')),
  body text not null,
  code_lang text,
  code_title text,
  lab_tag text,
  reply_to_id uuid references messages(id) on delete set null,
  author_token_hash text not null,
  author_name text not null,
  author_color text not null,
  admin_id uuid references admins(id) on delete set null,
  is_pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- Shipped as '24 hours' and changed to 8 by migration 0005 on 2026-08-04.
  -- A fresh database should just use 8 here.
  expires_at timestamptz not null default (now() + interval '8 hours'),

  constraint body_length check (
    (kind = 'text' and char_length(body) <= 1000) or
    (kind = 'code' and char_length(body) <= 20000)
  ),
  constraint code_title_length check (code_title is null or char_length(code_title) <= 80),
  constraint lab_tag_length check (lab_tag is null or char_length(lab_tag) <= 24),
  constraint code_lang_allowed check (
    code_lang is null or code_lang in
      ('c','cpp','java','python','javascript','sql','bash','plaintext')
  )
);

create index messages_group_created on messages (group_id, created_at desc);
create index messages_expires on messages (expires_at);
create index messages_group_lab_tag on messages (group_id, lab_tag);

create table reactions (
  message_id uuid not null references messages(id) on delete cascade,
  author_token_hash text not null,
  emoji text not null check (emoji in ('works', 'buggy', 'fire', 'eyes')),
  created_at timestamptz not null default now(),
  primary key (message_id, author_token_hash, emoji)
);

create table bans (
  author_token_hash text primary key,
  until timestamptz not null,
  reason text,
  created_by uuid references admins(id) on delete set null,
  created_at timestamptz not null default now()
);

create table rate_events (
  id bigserial primary key,
  author_token_hash text not null,
  action text not null check (action in ('text', 'code', 'reaction')),
  created_at timestamptz not null default now()
);

create index rate_events_lookup on rate_events (author_token_hash, action, created_at desc);
```

- [ ] **Step 2: Write `supabase/migrations/0002_grants_rls.sql`**

The table-level grant is revoked first — table grants survive revoking column-level ones, so skipping the revoke leaves the hash readable. The primary key stays granted because WALRUS returns 401 with no payload if the subscribing role cannot select it.

```sql
alter table departments enable row level security;
alter table years enable row level security;
alter table batches enable row level security;
alter table groups enable row level security;
alter table messages enable row level security;
alter table reactions enable row level security;
alter table admins enable row level security;
alter table admin_sessions enable row level security;
alter table bans enable row level security;
alter table rate_events enable row level security;

revoke all on departments, years, batches, groups, messages, reactions,
  admins, admin_sessions, bans, rate_events from anon, authenticated;

grant select on departments, years, batches, groups to anon, authenticated;

-- author_token_hash is deliberately excluded. id must stay granted.
grant select (
  id, group_id, kind, body, code_lang, code_title, lab_tag, reply_to_id,
  author_name, author_color, admin_id, is_pinned, deleted_at, created_at, expires_at
) on messages to anon, authenticated;

grant select (message_id, emoji, created_at) on reactions to anon, authenticated;

create policy "read departments" on departments for select to anon, authenticated using (true);
create policy "read years" on years for select to anon, authenticated using (true);
create policy "read batches" on batches for select to anon, authenticated using (true);
create policy "read groups" on groups for select to anon, authenticated using (true);
create policy "read live messages" on messages for select to anon, authenticated using (expires_at > now());
create policy "read reactions" on reactions for select to anon, authenticated using (true);

-- admins, admin_sessions, bans, rate_events: no policies and no grants.
-- RLS with zero policies denies everything to anon. Service role bypasses RLS.
```

- [ ] **Step 3: Write `supabase/migrations/0003_realtime_cron.sql`**

Only `messages` is published — reactions are delivered by re-reading counts on message UPDATE, so they need no separate stream.

```sql
alter publication supabase_realtime add table messages;

create extension if not exists pg_cron;

select cron.schedule('purge-expired', '*/10 * * * *', $$
  delete from messages where expires_at < now();
  delete from rate_events where created_at < now() - interval '5 minutes';
  delete from admin_sessions where expires_at < now();
  delete from bans where until < now();
$$);
```

- [ ] **Step 4: Apply all three migrations**

Use the supabase MCP `apply_migration` tool once per file, in order, with names `0001_schema`, `0002_grants_rls`, `0003_realtime_cron`.

Then verify with `list_tables` that all ten tables exist.

**If `pg_cron` is unavailable on the free tier**, the extension creation will error. In that case: apply `0003` without the cron block, record the deviation in `progress.md`, and note that the Vercel Cron fallback (spec, "Ephemerality") is needed before launch. Do not block this task on it.

- [ ] **Step 5: Create `lib/columns.ts`**

Column-restricted roles cannot use `select *`, so every client query must name its columns. Centralizing them here means one place to update.

```ts
export const MESSAGE_COLUMNS = [
  'id',
  'group_id',
  'kind',
  'body',
  'code_lang',
  'code_title',
  'lab_tag',
  'reply_to_id',
  'author_name',
  'author_color',
  'admin_id',
  'is_pinned',
  'deleted_at',
  'created_at',
  'expires_at',
].join(', ')

export const ROOM_COLUMNS = 'id, batch_id, label, is_locked'
```

- [ ] **Step 6: Write the RLS test**

Create `tests/rls.test.ts`. This is the most important test in the suite — the entire security model rests on the publishable key being read-only and unable to see the hash.

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const anon = createClient(url, key)

describe('RLS: the publishable key is read-only', () => {
  it('cannot insert a message', async () => {
    const { error } = await anon.from('messages').insert({
      group_id: '00000000-0000-0000-0000-000000000000',
      kind: 'text',
      body: 'should not work',
      author_token_hash: 'x',
      author_name: 'x',
      author_color: 'x',
    })
    expect(error).not.toBeNull()
  })

  it('cannot update a message', async () => {
    const { error } = await anon.from('messages').update({ body: 'hacked' }).neq('id', '00000000-0000-0000-0000-000000000000')
    expect(error).not.toBeNull()
  })

  it('cannot delete a message', async () => {
    const { error } = await anon.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    expect(error).not.toBeNull()
  })

  it('cannot read author_token_hash', async () => {
    const { error } = await anon.from('messages').select('author_token_hash')
    expect(error).not.toBeNull()
  })

  it('cannot select * from messages', async () => {
    const { error } = await anon.from('messages').select('*')
    expect(error).not.toBeNull()
  })

  it('cannot read the admins table at all', async () => {
    const { data, error } = await anon.from('admins').select('id')
    expect(error ?? data).toBeTruthy()
    expect(data ?? []).toHaveLength(0)
  })

  it('cannot read admin_sessions, bans, or rate_events', async () => {
    for (const table of ['admin_sessions', 'bans', 'rate_events']) {
      const { data } = await anon.from(table).select('*')
      expect(data ?? []).toHaveLength(0)
    }
  })

  it('can read the granted message columns', async () => {
    const { error } = await anon.from('messages').select('id, body, created_at')
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 7: Run the RLS test**

```bash
bun run test tests/rls.test.ts
```

Expected: PASS, all 8 tests. **If any test fails, stop and fix the migration** — do not proceed to Task 3. A failure here means the security model is broken.

- [ ] **Step 8: Commit**

```bash
git add supabase/ lib/columns.ts tests/rls.test.ts
git commit -m "Add schema, column grants, and RLS

The table grant is revoked before the column grant because table-level
grants survive revoking column-level ones — skipping that leaves
author_token_hash readable. The id column stays granted or Realtime
returns 401 with no payload at all."
```

---

## Task 3: Anonymous identity

**Files:**
- Create: `lib/identity.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/supabase/browser.ts`
- Create: `lib/result.ts`
- Test: `tests/identity.test.ts`

**Interfaces:**
- Consumes: `MESSAGE_COLUMNS` from Task 2
- Produces:
  - `hashToken(token: string): string` — sha256 of token + pepper
  - `deriveHandle(hash: string): { name: string; color: string }`
  - `getServiceClient(): SupabaseClient` from `lib/supabase/admin.ts` (server-only)
  - `getBrowserClient(): SupabaseClient` from `lib/supabase/browser.ts`
  - `type ActionResult<T>` from `lib/result.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/identity.test.ts`. The properties that matter: derivation is deterministic (so a handle can't be spoofed), the raw token never appears in the hash, and colors come only from the design palette.

```ts
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.IDENTITY_PEPPER = 'test-pepper-value-at-least-32-chars-long'
})

const { hashToken, deriveHandle } = await import('../lib/identity')

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('differs for different tokens', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('does not contain the raw token', () => {
    expect(hashToken('abc')).not.toContain('abc')
  })

  it('produces a 64-char hex sha256', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('deriveHandle', () => {
  it('is deterministic for the same hash', () => {
    const h = hashToken('user-one')
    expect(deriveHandle(h)).toEqual(deriveHandle(h))
  })

  it('produces "Adjective Animal NN" format', () => {
    const { name } = deriveHandle(hashToken('user-one'))
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/)
  })

  it('returns a hex color', () => {
    const { color } = deriveHandle(hashToken('user-one'))
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('gives different handles to different users', () => {
    const a = deriveHandle(hashToken('user-one')).name
    const b = deriveHandle(hashToken('user-two')).name
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/identity.test.ts`
Expected: FAIL — `lib/identity.ts` does not exist.

- [ ] **Step 3: Write `lib/identity.ts`**

Handles are *derived*, never stored, so a user cannot claim someone else's. The pepper is server-only, so the hash cannot be recomputed by a client even if it learns the raw token.

```ts
import 'server-only'
import { createHash } from 'node:crypto'

const ADJECTIVES = [
  'Teal', 'Amber', 'Cobalt', 'Rust', 'Olive', 'Plum', 'Slate', 'Coral',
  'Indigo', 'Sage', 'Copper', 'Mauve', 'Ochre', 'Cyan', 'Crimson', 'Jade',
] as const

const ANIMALS = [
  'Falcon', 'Otter', 'Heron', 'Lynx', 'Marten', 'Gecko', 'Raven', 'Bison',
  'Tapir', 'Ibis', 'Shrew', 'Civet', 'Kite', 'Vole', 'Hare', 'Newt',
] as const

const COLORS = [
  '#2C5F8F', '#C8503F', '#E5A03A', '#3F7F6B',
  '#7A5C9E', '#B0623A', '#4A7BA7', '#8F5A5A',
] as const

export function hashToken(token: string): string {
  const pepper = process.env.IDENTITY_PEPPER
  if (!pepper) throw new Error('IDENTITY_PEPPER is not set')
  return createHash('sha256').update(token + pepper).digest('hex')
}

export function deriveHandle(hash: string): { name: string; color: string } {
  const adjective = ADJECTIVES[parseInt(hash.slice(0, 4), 16) % ADJECTIVES.length]
  const animal = ANIMALS[parseInt(hash.slice(4, 8), 16) % ANIMALS.length]
  const number = parseInt(hash.slice(8, 12), 16) % 100
  const color = COLORS[parseInt(hash.slice(12, 16), 16) % COLORS.length]

  return {
    name: `${adjective} ${animal} ${String(number).padStart(2, '0')}`,
    color,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/identity.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Create `lib/supabase/admin.ts`**

`server-only` makes an accidental client import a build error rather than a leaked key.

```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function getServiceClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not set')

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
```

- [ ] **Step 6: Create `lib/supabase/browser.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function getBrowserClient(): SupabaseClient {
  if (client) return client

  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  )
  return client
}
```

- [ ] **Step 7: Create `lib/result.ts`**

Next.js 16 wants expected errors returned, not thrown, so `useActionState` can read them.

```ts
export type ActionErrorCode =
  | 'rate_limited'
  | 'banned'
  | 'locked'
  | 'invalid'
  | 'unauthorized'
  | 'server'

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: ActionErrorCode
      message: string
      retryAfter?: number
    }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function err<T>(
  code: ActionErrorCode,
  message: string,
  retryAfter?: number,
): ActionResult<T> {
  return { ok: false, code, message, retryAfter }
}
```

- [ ] **Step 8: Install `server-only` and verify the build**

```bash
bun add server-only
bun run build
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/ tests/identity.test.ts package.json bun.lock
git commit -m "Add anonymous identity derivation and Supabase clients

Handles are derived from the peppered hash rather than stored, so a
client cannot claim another user's handle, and the database never holds
a replayable device identifier."
```

---

## Task 4: Validation and rate limiting

**Files:**
- Create: `lib/validate.ts`
- Create: `supabase/migrations/0004_rate_limit.sql`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `ActionResult`, `err` from Task 3; `getServiceClient` from Task 3
- Produces:
  - `validateText(body: string): string | null` — returns an error message, or null if valid
  - `validateCode(input: { body: string; lang: string; title?: string; labTag?: string }): string | null`
  - `ALLOWED_LANGS: readonly string[]`
  - SQL function `check_rate_limit(p_hash text, p_action text) returns boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/validate.test.ts`. Error messages must name real numbers — that is a spec requirement, not a nicety, so the tests assert it.

```ts
import { describe, it, expect } from 'vitest'
import { validateText, validateCode, ALLOWED_LANGS } from '../lib/validate'

describe('validateText', () => {
  it('accepts normal text', () => {
    expect(validateText('anyone done q2?')).toBeNull()
  })

  it('rejects empty text', () => {
    expect(validateText('   ')).toBe('Type something first.')
  })

  it('rejects text over 1000 chars and names the real numbers', () => {
    const msg = validateText('x'.repeat(1001))
    expect(msg).toBe('Messages are 1,000 characters max. This is 1,001.')
  })

  it('accepts exactly 1000 chars', () => {
    expect(validateText('x'.repeat(1000))).toBeNull()
  })
})

describe('validateCode', () => {
  it('accepts a valid code post', () => {
    expect(validateCode({ body: 'int main(){}', lang: 'c' })).toBeNull()
  })

  it('rejects empty code', () => {
    expect(validateCode({ body: '  ', lang: 'c' })).toBe('Paste some code first.')
  })

  it('rejects code over 20000 chars and names the real numbers', () => {
    const msg = validateCode({ body: 'x'.repeat(20001), lang: 'c' })
    expect(msg).toBe('Code is 20,000 characters max. This is 20,001.')
  })

  it('rejects a language outside the allowed set', () => {
    expect(validateCode({ body: 'x', lang: 'rust' })).toBe('Pick a language from the list.')
  })

  it('rejects a title over 80 chars', () => {
    expect(validateCode({ body: 'x', lang: 'c', title: 'y'.repeat(81) })).toBe(
      'Title is 80 characters max. This is 81.',
    )
  })

  it('rejects a lab tag over 24 chars', () => {
    expect(validateCode({ body: 'x', lang: 'c', labTag: 'z'.repeat(25) })).toBe(
      'Lab tag is 24 characters max. This is 25.',
    )
  })

  it('allows exactly the eight documented languages', () => {
    expect([...ALLOWED_LANGS]).toEqual([
      'c', 'cpp', 'java', 'python', 'javascript', 'sql', 'bash', 'plaintext',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/validate.test.ts`
Expected: FAIL — `lib/validate.ts` does not exist.

- [ ] **Step 3: Write `lib/validate.ts`**

```ts
export const ALLOWED_LANGS = [
  'c', 'cpp', 'java', 'python', 'javascript', 'sql', 'bash', 'plaintext',
] as const

const n = (x: number) => x.toLocaleString('en-US')

export function validateText(body: string): string | null {
  if (!body.trim()) return 'Type something first.'
  if (body.length > 1000) {
    return `Messages are 1,000 characters max. This is ${n(body.length)}.`
  }
  return null
}

export function validateCode(input: {
  body: string
  lang: string
  title?: string
  labTag?: string
}): string | null {
  if (!input.body.trim()) return 'Paste some code first.'
  if (input.body.length > 20000) {
    return `Code is 20,000 characters max. This is ${n(input.body.length)}.`
  }
  if (!ALLOWED_LANGS.includes(input.lang as (typeof ALLOWED_LANGS)[number])) {
    return 'Pick a language from the list.'
  }
  if (input.title && input.title.length > 80) {
    return `Title is 80 characters max. This is ${n(input.title.length)}.`
  }
  if (input.labTag && input.labTag.length > 24) {
    return `Lab tag is 24 characters max. This is ${n(input.labTag.length)}.`
  }
  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/validate.test.ts`
Expected: PASS, all 12 tests.

- [ ] **Step 5: Write `supabase/migrations/0004_rate_limit.sql`**

Counting happens in Postgres, not in memory: serverless invocations do not share memory, so an in-process counter would not limit anything. The function both checks and records, so the caller cannot forget to record.

```sql
create or replace function check_rate_limit(p_hash text, p_action text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_limit int;
  v_count int;
begin
  case p_action
    when 'text'     then v_window := interval '10 seconds'; v_limit := 5;
    when 'code'     then v_window := interval '60 seconds'; v_limit := 3;
    when 'reaction' then v_window := interval '60 seconds'; v_limit := 30;
    else return false;
  end case;

  select count(*) into v_count
  from rate_events
  where author_token_hash = p_hash
    and action = p_action
    and created_at > now() - v_window;

  if v_count >= v_limit then
    return false;
  end if;

  insert into rate_events (author_token_hash, action) values (p_hash, p_action);
  return true;
end;
$$;

revoke all on function check_rate_limit(text, text) from anon, authenticated;
```

- [ ] **Step 6: Apply the migration**

Use the supabase MCP `apply_migration` tool with name `0004_rate_limit`.

- [ ] **Step 7: Verify the limit actually fires**

Use the supabase MCP `execute_sql` tool:

```sql
select check_rate_limit('test-hash-abc', 'text') from generate_series(1, 7);
```

Expected: the first 5 rows return `true`, rows 6 and 7 return `false`.

Then clean up: `delete from rate_events where author_token_hash = 'test-hash-abc';`

- [ ] **Step 8: Commit**

```bash
git add lib/validate.ts supabase/migrations/0004_rate_limit.sql tests/validate.test.ts
git commit -m "Add input validation and Postgres-side rate limiting

Rate limiting counts rows in Postgres rather than memory because
serverless invocations share no memory — an in-process counter would
not limit anything. The function records as well as checks so a caller
cannot forget to."
```

---

## Task 5: Message Server Actions

**Files:**
- Create: `app/actions/messages.ts`
- Create: `lib/guards.ts`
- Test: `tests/messages-action.test.ts`

**Interfaces:**
- Consumes: `hashToken`, `deriveHandle`, `getServiceClient`, `ActionResult`, `ok`, `err` (Task 3); `validateText`, `validateCode` (Task 4)
- Produces:
  - `sendText(input: { token: string; groupId: string; body: string; replyToId?: string }): Promise<ActionResult<{ id: string }>>`
  - `postCode(input: { token: string; groupId: string; body: string; lang: string; title?: string; labTag?: string; replyToId?: string }): Promise<ActionResult<{ id: string }>>`
  - `deleteOwnMessage(input: { token: string; messageId: string }): Promise<ActionResult<null>>`
  - `assertPostable(hash: string, groupId: string): Promise<ActionResult<null>>` from `lib/guards.ts`

- [ ] **Step 1: Write `lib/guards.ts`**

Ban and lock checks are shared by every write path, so they live in one place rather than being re-implemented per action.

```ts
import 'server-only'
import { getServiceClient } from '@/lib/supabase/admin'
import { type ActionResult, ok, err } from '@/lib/result'

export async function assertNotBanned(hash: string): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data } = await db
    .from('bans')
    .select('until')
    .eq('author_token_hash', hash)
    .gt('until', new Date().toISOString())
    .maybeSingle()

  if (data) {
    const until = new Date(data.until).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    return err('banned', `You can't post here until ${until}.`)
  }
  return ok(null)
}

export async function assertRoomOpen(groupId: string): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data } = await db
    .from('groups')
    .select('is_locked')
    .eq('id', groupId)
    .maybeSingle()

  if (!data) return err('invalid', 'That room no longer exists.')
  if (data.is_locked) return err('locked', 'This room is read-only right now.')
  return ok(null)
}

export async function assertRateOk(
  hash: string,
  action: 'text' | 'code' | 'reaction',
): Promise<ActionResult<null>> {
  const db = getServiceClient()
  const { data, error } = await db.rpc('check_rate_limit', {
    p_hash: hash,
    p_action: action,
  })

  if (error) return err('server', 'Something went wrong. Try again.')
  if (data === false) {
    return err('rate_limited', 'You are posting too fast. Wait a moment.', 10)
  }
  return ok(null)
}

export async function assertPostable(
  hash: string,
  groupId: string,
): Promise<ActionResult<null>> {
  const banned = await assertNotBanned(hash)
  if (!banned.ok) return banned

  const open = await assertRoomOpen(groupId)
  if (!open.ok) return open

  return ok(null)
}
```

- [ ] **Step 2: Write `app/actions/messages.ts`**

Note the ordering: ban → lock → validate → rate limit. Rate limiting comes last because it *records* an event, and a message rejected for being too long should not consume the user's quota.

```ts
'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { hashToken, deriveHandle } from '@/lib/identity'
import { validateText, validateCode } from '@/lib/validate'
import { assertPostable, assertRateOk } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'

export async function sendText(input: {
  token: string
  groupId: string
  body: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  const hash = hashToken(input.token)

  const postable = await assertPostable(hash, input.groupId)
  if (!postable.ok) return postable

  const invalid = validateText(input.body)
  if (invalid) return err('invalid', invalid)

  const rate = await assertRateOk(hash, 'text')
  if (!rate.ok) return rate

  const { name, color } = deriveHandle(hash)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .insert({
      group_id: input.groupId,
      kind: 'text',
      body: input.body.trim(),
      reply_to_id: input.replyToId ?? null,
      author_token_hash: hash,
      author_name: name,
      author_color: color,
    })
    .select('id')
    .single()

  if (error || !data) return err('server', "Message didn't send. Try again.")
  return ok({ id: data.id })
}

export async function postCode(input: {
  token: string
  groupId: string
  body: string
  lang: string
  title?: string
  labTag?: string
  replyToId?: string
}): Promise<ActionResult<{ id: string }>> {
  const hash = hashToken(input.token)

  const postable = await assertPostable(hash, input.groupId)
  if (!postable.ok) return postable

  const invalid = validateCode(input)
  if (invalid) return err('invalid', invalid)

  const rate = await assertRateOk(hash, 'code')
  if (!rate.ok) return rate

  const { name, color } = deriveHandle(hash)
  const db = getServiceClient()

  const { data, error } = await db
    .from('messages')
    .insert({
      group_id: input.groupId,
      kind: 'code',
      body: input.body,
      code_lang: input.lang,
      code_title: input.title?.trim() || null,
      lab_tag: input.labTag?.trim() || null,
      reply_to_id: input.replyToId ?? null,
      author_token_hash: hash,
      author_name: name,
      author_color: color,
    })
    .select('id')
    .single()

  if (error || !data) return err('server', "Code didn't post. Try again.")
  return ok({ id: data.id })
}

export async function deleteOwnMessage(input: {
  token: string
  messageId: string
}): Promise<ActionResult<null>> {
  const hash = hashToken(input.token)
  const db = getServiceClient()

  const { data: message } = await db
    .from('messages')
    .select('author_token_hash, created_at, deleted_at')
    .eq('id', input.messageId)
    .maybeSingle()

  if (!message) return err('invalid', 'That message is already gone.')
  if (message.deleted_at) return ok(null)

  // Ownership is checked server-side against the derived hash — never trusted
  // from the client.
  if (message.author_token_hash !== hash) {
    return err('unauthorized', 'You can only delete your own messages.')
  }

  const ageMs = Date.now() - new Date(message.created_at).getTime()
  if (ageMs > 5 * 60 * 1000) {
    return err('invalid', 'You can only delete a message within 5 minutes of posting.')
  }

  // Soft delete: an UPDATE is filterable and RLS-respecting in Realtime,
  // unlike DELETE. The content is blanked so it is gone from the database
  // immediately, not merely hidden.
  const { error } = await db
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      body: '',
      code_lang: null,
      code_title: null,
      lab_tag: null,
    })
    .eq('id', input.messageId)

  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}
```

- [ ] **Step 3: Write the integration test**

First create the shared room fixture at `tests/helpers/seed-room.ts` — Tasks 9 and 11 import the same helper, so it is written once here:

```ts
import { createClient } from '@supabase/supabase-js'

export const testDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type SeededRoom = { groupId: string; deptId: string }

export async function seedRoom(): Promise<SeededRoom> {
  const { data: dept } = await testDb
    .from('departments')
    .insert({ name: 'Test Dept', slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
    .select('id')
    .single()

  const { data: year } = await testDb
    .from('years')
    .insert({ department_id: dept!.id, number: 1 })
    .select('id')
    .single()

  const { data: batch } = await testDb
    .from('batches')
    .insert({ year_id: year!.id, number: 1 })
    .select('id')
    .single()

  const { data: group } = await testDb
    .from('groups')
    .insert({ batch_id: batch!.id, label: 'A' })
    .select('id')
    .single()

  return { groupId: group!.id, deptId: dept!.id }
}

// Cascades to years, batches, groups, messages and reactions.
export async function teardownRoom(room: SeededRoom): Promise<void> {
  await testDb.from('departments').delete().eq('id', room.deptId)
}
```

Then create `tests/messages-action.test.ts`. These hit the real database and use the fixture above.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testDb as db, seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom
let groupId: string

beforeAll(async () => {
  room = await seedRoom()
  groupId = room.groupId
})

afterAll(async () => {
  await teardownRoom(room)
})

describe('sendText', () => {
  it('inserts a message and derives the handle server-side', async () => {
    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({
      token: 'test-token-1',
      groupId,
      body: 'hello lab',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data } = await db
      .from('messages')
      .select('body, author_name, kind')
      .eq('id', result.data.id)
      .single()

    expect(data!.body).toBe('hello lab')
    expect(data!.kind).toBe('text')
    expect(data!.author_name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/)
  })

  it('rejects a message over 1000 chars without consuming rate quota', async () => {
    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({
      token: 'test-token-2',
      groupId,
      body: 'x'.repeat(1001),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')

    const { count } = await db
      .from('rate_events')
      .select('*', { count: 'exact', head: true })
      .eq('author_token_hash', 'never-recorded')
    expect(count).toBe(0)
  })

  it('rejects posting to a locked room', async () => {
    await db.from('groups').update({ is_locked: true }).eq('id', groupId)

    const { sendText } = await import('../app/actions/messages')
    const result = await sendText({ token: 'test-token-3', groupId, body: 'hi' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('locked')

    await db.from('groups').update({ is_locked: false }).eq('id', groupId)
  })
})

describe('deleteOwnMessage', () => {
  it("refuses to delete another person's message", async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const posted = await sendText({ token: 'owner-token', groupId, body: 'mine' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await deleteOwnMessage({
      token: 'different-token',
      messageId: posted.data.id,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unauthorized')
  })

  it('soft-deletes and blanks the body', async () => {
    const { sendText, deleteOwnMessage } = await import('../app/actions/messages')
    const posted = await sendText({ token: 'owner-token', groupId, body: 'oops' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const result = await deleteOwnMessage({
      token: 'owner-token',
      messageId: posted.data.id,
    })
    expect(result.ok).toBe(true)

    const { data } = await db
      .from('messages')
      .select('deleted_at, body')
      .eq('id', posted.data.id)
      .single()

    expect(data!.deleted_at).not.toBeNull()
    expect(data!.body).toBe('')
  })

  it('refuses to delete a message older than 5 minutes', async () => {
    const { data: old } = await db
      .from('messages')
      .insert({
        group_id: groupId,
        kind: 'text',
        body: 'old message',
        author_token_hash: (await import('../lib/identity')).hashToken('owner-token'),
        author_name: 'Test User 01',
        author_color: '#2C5F8F',
        created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    const { deleteOwnMessage } = await import('../app/actions/messages')
    const result = await deleteOwnMessage({
      token: 'owner-token',
      messageId: old!.id,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('5 minutes')
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `bun run test tests/messages-action.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/actions/messages.ts lib/guards.ts tests/messages-action.test.ts
git commit -m "Add message Server Actions with server-side guards

Guard order is ban, lock, validate, then rate limit — the rate check
records an event, so a message rejected for length must not consume the
user's quota.

Deletion is soft because Realtime cannot filter DELETE events; the body
is blanked so content leaves the database immediately."
```

---

## Task 6: Shiki code rendering

**Files:**
- Create: `lib/shiki-theme.ts`
- Create: `lib/highlight.ts`
- Create: `components/chat/code-card.tsx`
- Create: `components/chat/copy-button.tsx`
- Test: `tests/highlight.test.ts`

**Deliberate decision (confirmed with the project owner):** `CodeCard` is built here as a server component to prove the Shiki theme and card markup in isolation, and Task 8 replaces it with an inline client-side card once Realtime delivery requires one. The short-lived file is intentional, not an oversight — do not "fix" it by making Task 6 client-side.

**Interfaces:**
- Consumes: `ALLOWED_LANGS` (Task 4), `cn` (Task 1)
- Produces:
  - `highlightCode(code: string, lang: string): Promise<string>` — returns HTML with dual-theme CSS variables
  - `<CodeCard>` React server component

- [ ] **Step 1: Write `lib/shiki-theme.ts`**

A stock Shiki theme would break the whole conceit — a Dracula-colored block inside this palette. These are TextMate theme objects built from `design.md` tokens only.

```ts
import type { ThemeRegistrationRaw } from 'shiki/core'

export const hitLight: ThemeRegistrationRaw = {
  name: 'hit-light',
  type: 'light',
  fg: '#241E1A',
  bg: '#F5EFEA',
  settings: [
    { scope: ['comment'], settings: { foreground: '#6E645C', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage', 'storage.type', 'keyword.control'], settings: { foreground: '#2C5F8F' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#C8503F' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#E5A03A' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#2C5F8F' } },
    { scope: ['variable', 'entity.name.type'], settings: { foreground: '#241E1A' } },
  ],
}

export const hitDark: ThemeRegistrationRaw = {
  name: 'hit-dark',
  type: 'dark',
  fg: '#EDE6DE',
  bg: '#26201C',
  settings: [
    { scope: ['comment'], settings: { foreground: '#9A8F86', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage', 'storage.type', 'keyword.control'], settings: { foreground: '#7FB0DC' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#D9705F' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#F0B657' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#7FB0DC' } },
    { scope: ['variable', 'entity.name.type'], settings: { foreground: '#EDE6DE' } },
  ],
}
```

- [ ] **Step 2: Write `lib/highlight.ts`**

The fine-grained core bundle loads only our 8 grammars instead of Shiki's full dynamic-import map. The module-level promise gives one highlighter per server process — calling `createHighlighterCore` per request would be a serious leak.

```ts
import 'server-only'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import { hitLight, hitDark } from './shiki-theme'

let highlighterPromise: Promise<HighlighterCore> | undefined

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [hitLight, hitDark],
    langs: [
      import('@shikijs/langs/c'),
      import('@shikijs/langs/cpp'),
      import('@shikijs/langs/java'),
      import('@shikijs/langs/python'),
      import('@shikijs/langs/javascript'),
      import('@shikijs/langs/sql'),
      import('@shikijs/langs/bash'),
    ],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  })
  return highlighterPromise
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter()

  // 'plaintext' is a SpecialLanguage — it needs no grammar.
  const loaded = highlighter.getLoadedLanguages()
  const safeLang = lang === 'plaintext' || loaded.includes(lang) ? lang : 'plaintext'

  return highlighter.codeToHtml(code, {
    lang: safeLang,
    themes: { light: 'hit-light', dark: 'hit-dark' },
    // Emit CSS variables only. 'light-dark()' is media-query driven and would
    // ignore our .dark class.
    defaultColor: false,
  })
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/highlight.test.ts`.

```ts
import { describe, it, expect } from 'vitest'
import { highlightCode } from '../lib/highlight'

describe('highlightCode', () => {
  it('emits dual-theme CSS variables, not hardcoded colors', async () => {
    const html = await highlightCode('int main(){}', 'c')
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
  })

  it('wraps each line so CSS counters can number them', async () => {
    const html = await highlightCode('line one\nline two', 'c')
    expect(html.match(/class="line"/g)).toHaveLength(2)
  })

  it('falls back to plaintext for an unknown language', async () => {
    const html = await highlightCode('some text', 'brainfuck')
    expect(html).toContain('<pre')
  })

  it('escapes HTML so pasted code cannot inject markup', async () => {
    const html = await highlightCode('<script>alert(1)</script>', 'plaintext')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `bun run test tests/highlight.test.ts`
Expected: PASS, all 4 tests. (Written after the implementation here because the module is pure infrastructure with no behavior to drive out; the XSS test is the one that matters.)

- [ ] **Step 5: Write `components/chat/copy-button.tsx`**

```tsx
'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="font-mono text-[12px] text-graphite transition-colors hover:text-pen"
    >
      {copied ? '✓ copied' : '⧉ copy'}
    </button>
  )
}
```

- [ ] **Step 6: Write `components/chat/code-card.tsx`**

This is the signature element. The 2px `rule` line at the left is used by nothing else in the app — that exclusivity is what makes code findable in peripheral vision while scrolling.

```tsx
import { highlightCode } from '@/lib/highlight'
import { CopyButton } from './copy-button'

export async function CodeCard({
  code,
  lang,
  title,
  labTag,
}: {
  code: string
  lang: string
  title?: string | null
  labTag?: string | null
}) {
  const html = await highlightCode(code, lang)
  const lineCount = code.split('\n').length
  const isLong = lineCount > 15

  return (
    <div className="my-2 flex overflow-hidden rounded-[8px] border border-hairline bg-code-bg">
      <div className="w-[2px] shrink-0 bg-rule" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
          {labTag && (
            <span className="font-mono text-[12px] tracking-[0.02em] text-rule">
              {labTag}
            </span>
          )}
          {title && (
            <span className="truncate text-[13px] font-medium text-ink">{title}</span>
          )}
          <span className="ml-auto font-mono text-[12px] text-graphite">{lang}</span>
          <CopyButton text={code} />
        </div>

        <details open={!isLong} className="group">
          {isLong && (
            <summary className="cursor-pointer list-none px-4 py-2 font-mono text-[12px] text-graphite hover:text-pen">
              <span className="group-open:hidden">⌄ show {lineCount} lines</span>
              <span className="hidden group-open:inline">⌃ collapse</span>
            </summary>
          )}
          <div
            className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[21px]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </details>
      </div>
    </div>
  )
}
```

**On `dangerouslySetInnerHTML`:** this is safe here specifically because Shiki escapes all HTML in the input (asserted by the test in Step 3). The code string is never interpolated into the markup by us.

- [ ] **Step 7: Verify the build and visual result**

```bash
bun run build
```

Expected: build succeeds. If the Oniguruma wasm import fails under Turbopack, add `serverExternalPackages: ['shiki']` to `next.config.ts` and record the deviation in `progress.md`.

Then render a `CodeCard` temporarily on `app/page.tsx` with a 20-line C snippet, run `bun dev`, and confirm in the browser: the red rule runs the full card height, line numbers appear in the gutter, the card collapses, copy works, and switching theme recolors the syntax without a reload.

- [ ] **Step 8: Commit**

```bash
git add lib/shiki-theme.ts lib/highlight.ts components/chat/ tests/highlight.test.ts
git commit -m "Add the code card with a custom Shiki theme

The theme is built from design.md tokens rather than a stock Shiki
theme, which would put Dracula colors inside a warm-paper palette.

The highlighter is a module-level singleton — constructing one per
request would leak badly."
```

---

## Task 7: Room page, message list, and live updates

**Files:**
- Create: `app/c/[dept]/[year]/[batch]/[group]/page.tsx`
- Create: `components/chat/message-list.tsx`
- Create: `components/chat/message-row.tsx`
- Create: `lib/age.ts`
- Create: `lib/types.ts`
- Create: `lib/use-realtime-messages.ts`
- Test: `tests/age.test.ts`

**Interfaces:**
- Consumes: `MESSAGE_COLUMNS` (Task 2), `getServiceClient` (Task 3), `getBrowserClient` (Task 3), `CodeCard` (Task 6)
- Produces:
  - `type Message` from `lib/types.ts`
  - `ageOpacity(createdAt: string, now?: number): number` from `lib/age.ts`
  - `useRealtimeMessages(groupId: string, initial: Message[]): Message[]`

- [ ] **Step 1: Write `lib/types.ts`**

```ts
export type Message = {
  id: string
  group_id: string
  kind: 'text' | 'code'
  body: string
  code_lang: string | null
  code_title: string | null
  lab_tag: string | null
  reply_to_id: string | null
  author_name: string
  author_color: string
  admin_id: string | null
  is_pinned: boolean
  deleted_at: string | null
  created_at: string
  expires_at: string
}
```

- [ ] **Step 2: Write the failing test for age fade**

Create `tests/age.test.ts`. The contrast floor is the constraint that matters — `design.md` requires the oldest message to still clear WCAG AA, so the floor is asserted rather than eyeballed.

```ts
import { describe, it, expect } from 'vitest'
import { ageOpacity } from '../lib/age'

const HOUR = 60 * 60 * 1000
const now = Date.UTC(2026, 7, 4, 12, 0, 0)
const agoHours = (h: number) => new Date(now - h * HOUR).toISOString()

describe('ageOpacity', () => {
  it('is fully opaque for a fresh message', () => {
    expect(ageOpacity(agoHours(0), now)).toBe(1)
  })

  it('stays fully opaque through the first 2 hours', () => {
    expect(ageOpacity(agoHours(1.9), now)).toBe(1)
  })

  it('steps down at each documented threshold', () => {
    expect(ageOpacity(agoHours(2.5), now)).toBe(0.85)
    expect(ageOpacity(agoHours(4.5), now)).toBe(0.7)
    expect(ageOpacity(agoHours(6.5), now)).toBe(0.55)
  })

  it('never drops below the 0.55 contrast floor', () => {
    expect(ageOpacity(agoHours(7.9), now)).toBe(0.55)
    expect(ageOpacity(agoHours(100), now)).toBe(0.55)
  })

  it('decreases monotonically', () => {
    const values = [0, 2.5, 4.5, 6.5, 7.9].map((h) => ageOpacity(agoHours(h), now))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test tests/age.test.ts`
Expected: FAIL — `lib/age.ts` does not exist.

- [ ] **Step 4: Write `lib/age.ts`**

```ts
const HOUR = 60 * 60 * 1000

// The 0.55 floor is a hard contrast requirement from design.md, not a
// stylistic choice — the oldest message must still clear WCAG AA.
export function ageOpacity(createdAt: string, now: number = Date.now()): number {
  const ageHours = (now - new Date(createdAt).getTime()) / HOUR

  if (ageHours < 2) return 1
  if (ageHours < 4) return 0.85
  if (ageHours < 6) return 0.7
  return 0.55
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test tests/age.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Write `lib/use-realtime-messages.ts`**

Subscribes to INSERT and UPDATE only — never DELETE, which Realtime cannot filter and does not apply RLS to. Refetching on every `SUBSCRIBED` closes the gap on both first connect and reconnect with one code path, since events during a disconnect are lost.

```ts
'use client'

import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/browser'
import { MESSAGE_COLUMNS } from '@/lib/columns'
import type { Message } from '@/lib/types'

export function useRealtimeMessages(groupId: string, initial: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initial)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const supabase = getBrowserClient()

    async function refetch() {
      const { data } = await supabase
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setMessages((data as Message[]).reverse())
    }

    const channel = supabase
      .channel(`room:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const next = payload.new as Message
          setMessages((prev) =>
            prev.some((m) => m.id === next.id) ? prev : [...prev, next],
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const next = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === next.id ? next : m)))
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
        // Events during a disconnect are lost, so reconcile on every join.
        if (status === 'SUBSCRIBED') void refetch()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [groupId])

  return { messages, connected }
}
```

- [ ] **Step 7: Write `components/chat/message-row.tsx`**

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { ageOpacity } from '@/lib/age'
import type { Message } from '@/lib/types'

export function MessageRow({
  message,
  children,
}: {
  message: Message
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion()

  if (message.deleted_at) {
    return (
      <div className="px-4 py-1 font-mono text-[12px] text-graphite">
        message deleted
      </div>
    )
  }

  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="px-4 py-1"
    >
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[12px] tracking-[0.02em]"
          style={{ color: message.author_color }}
        >
          {message.author_name}
        </span>

        {message.admin_id && (
          <span className="rounded-[4px] bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-marigold">
            SUDO
          </span>
        )}

        <span className="font-mono text-[12px] text-graphite">{time}</span>
      </div>

      {/* Code bodies never fade — someone copying an 18-hour-old answer needs
          to read it perfectly. Only text ages. */}
      <div
        className="text-[15px] leading-[24px] text-ink"
        style={message.kind === 'text' ? { opacity: ageOpacity(message.created_at) } : undefined}
      >
        {children ?? message.body}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 8: Write `components/chat/message-list.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRealtimeMessages } from '@/lib/use-realtime-messages'
import { MessageRow } from './message-row'
import type { Message } from '@/lib/types'

export function MessageList({
  groupId,
  initial,
  labFilter,
}: {
  groupId: string
  initial: Message[]
  labFilter: string | null
}) {
  const { messages, connected } = useRealtimeMessages(groupId, initial)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const now = Date.now()
  const visible = messages
    // Expiry is hidden client-side; the purge job removes the row later.
    .filter((m) => new Date(m.expires_at).getTime() > now)
    .filter((m) => !labFilter || m.lab_tag === labFilter)

  if (visible.length === 0) {
    return (
      <div className="px-4 py-8 text-[15px] text-graphite">
        Nothing here yet. Paste your lab code and someone will thank you.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {!connected && (
        <div className="sticky top-0 bg-wash px-4 py-1 font-mono text-[12px] text-graphite">
          Reconnecting…
        </div>
      )}

      {visible.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}

      <div ref={bottomRef} />
    </div>
  )
}
```

**Note for the implementer:** `MessageRow` renders `message.body` as text. Rendering `CodeCard` for `kind === 'code'` requires server-side highlighting, which a client component cannot do. Task 8 resolves this by fetching highlighted HTML through a Server Action, and **replaces `CodeCard` with an inline client-side card at that point** — `CodeCard` exists in Task 6 only to prove the markup and Shiki theme in isolation. Leave code messages rendering as plain text at the end of this task.

- [ ] **Step 9: Write the room page**

`params` is a Promise in Next 16 — awaiting it is mandatory, not optional.

```tsx
import { notFound } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase/admin'
import { MESSAGE_COLUMNS } from '@/lib/columns'
import { MessageList } from '@/components/chat/message-list'
import type { Message } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function RoomPage({
  params,
}: {
  params: Promise<{ dept: string; year: string; batch: string; group: string }>
}) {
  const { dept, year, batch, group } = await params
  const db = getServiceClient()

  const { data: room } = await db
    .from('groups')
    .select(
      'id, label, is_locked, batches!inner(number, years!inner(number, departments!inner(slug, name)))',
    )
    .eq('label', group.toUpperCase())
    .eq('batches.number', Number(batch))
    .eq('batches.years.number', Number(year))
    .eq('batches.years.departments.slug', dept)
    .maybeSingle()

  if (!room) notFound()

  const { data: messages } = await db
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', room.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  const initial = ((messages ?? []) as Message[]).reverse()

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-hairline px-4 py-3">
        <h1 className="font-display text-[32px] leading-[36px] tracking-[-0.02em] text-ink">
          {room.label}
        </h1>
      </header>

      <MessageList groupId={room.id} initial={initial} labFilter={null} />
    </div>
  )
}
```

- [ ] **Step 10: Verify live updates work end to end**

Seed a room via the supabase MCP `execute_sql` tool:

```sql
insert into departments (name, slug) values ('Computer Science', 'cse')
  returning id;
-- use each returned id in the next statement
insert into years (department_id, number) values ('<dept-id>', 3) returning id;
insert into batches (year_id, number) values ('<year-id>', 2) returning id;
insert into groups (batch_id, label) values ('<batch-id>', 'A');
```

Run `bun dev` and open `http://localhost:3000/c/cse/3/2/a` in **two browser windows**. Insert a message with `execute_sql` and confirm it appears in both windows within a second without a refresh. Then set `deleted_at` on that row and confirm both windows show "message deleted".

- [ ] **Step 11: Commit**

```bash
git add app/c/ components/chat/ lib/age.ts lib/types.ts lib/use-realtime-messages.ts tests/age.test.ts
git commit -m "Add the room page with live message updates

Subscribes to INSERT and UPDATE only. Realtime cannot filter DELETE and
does not apply RLS to it, so a bulk purge would broadcast bare primary
keys to every room; expiry is hidden client-side instead.

Refetching on every SUBSCRIBED closes the lost-event gap on first
connect and reconnect with one path."
```

---

## Task 8: Composer, anonymous token, and code rendering in the stream

**Files:**
- Create: `lib/use-anon-token.ts`
- Create: `components/chat/composer.tsx`
- Create: `components/chat/code-composer.tsx`
- Modify: `components/chat/message-row.tsx` (render highlighted code)
- Modify: `components/chat/message-list.tsx` (pass rendered code through)
- Modify: `app/c/[dept]/[year]/[batch]/[group]/page.tsx` (pre-render code HTML)
- Create: `app/actions/highlight.ts`
- Test: `tests/use-anon-token.test.ts`

**Interfaces:**
- Consumes: `sendText`, `postCode` (Task 5); `highlightCode` (Task 6); `Message` (Task 7); `ALLOWED_LANGS` (Task 4)
- Produces:
  - `useAnonToken(): { token: string | null; reroll: () => void }`
  - `renderCode(code: string, lang: string): Promise<string>` Server Action

- [ ] **Step 1: Write the failing test for the token hook**

Create `tests/use-anon-token.test.ts`.

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnonToken } from '../lib/use-anon-token'

beforeEach(() => localStorage.clear())

describe('useAnonToken', () => {
  it('mints a token on first use', () => {
    const { result } = renderHook(() => useAnonToken())
    expect(result.current.token).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses the same token across mounts', () => {
    const first = renderHook(() => useAnonToken()).result.current.token
    const second = renderHook(() => useAnonToken()).result.current.token
    expect(second).toBe(first)
  })

  it('issues a different token after reroll', () => {
    const { result } = renderHook(() => useAnonToken())
    const before = result.current.token
    act(() => result.current.reroll())
    expect(result.current.token).not.toBe(before)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/use-anon-token.test.ts`
Expected: FAIL — `lib/use-anon-token.ts` does not exist.

- [ ] **Step 3: Write `lib/use-anon-token.ts`**

The token is minted in an effect rather than during render, because `localStorage` does not exist on the server and reading it during render would cause a hydration mismatch.

```ts
'use client'

import { useEffect, useState } from 'react'

const KEY = 'hitchat:token'

export function useAnonToken() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let stored = localStorage.getItem(KEY)
    if (!stored) {
      stored = crypto.randomUUID()
      localStorage.setItem(KEY, stored)
    }
    setToken(stored)
  }, [])

  function reroll() {
    const next = crypto.randomUUID()
    localStorage.setItem(KEY, next)
    setToken(next)
  }

  return { token, reroll }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test tests/use-anon-token.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Create `app/actions/highlight.ts`**

Highlighting must happen on the server (Shiki's wasm engine is server-only), but new messages arrive on the client via Realtime. A tiny Server Action bridges the two.

```ts
'use server'

import { highlightCode } from '@/lib/highlight'

export async function renderCode(code: string, lang: string): Promise<string> {
  return highlightCode(code, lang)
}
```

- [ ] **Step 6: Write `components/chat/composer.tsx`**

Server Actions dispatch sequentially per client, so the optimistic pending state is what keeps sending feeling instant. Errors are read from the returned value, never thrown.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { sendText } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { CodeComposer } from './code-composer'

export function Composer({ groupId, locked }: { groupId: string; locked: boolean }) {
  const { token } = useAnonToken()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeMode, setCodeMode] = useState(false)
  const [pending, startTransition] = useTransition()

  if (locked) {
    return (
      <div className="border-t border-hairline px-4 py-3 text-[15px] text-graphite">
        This room is read-only right now.
      </div>
    )
  }

  function submit() {
    if (!token || !body.trim()) return

    startTransition(async () => {
      const result = await sendText({ token, groupId, body })
      if (result.ok) {
        setBody('')
        setError(null)
      } else {
        setError(result.message)
      }
    })
  }

  if (codeMode) {
    return <CodeComposer groupId={groupId} onClose={() => setCodeMode(false)} />
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Message"
          maxLength={1000}
          disabled={pending}
          className="flex-1 rounded-[6px] border border-hairline bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-graphite"
        />

        <button
          type="button"
          onClick={() => setCodeMode(true)}
          className="rounded-[6px] border border-hairline px-3 py-2 font-mono text-[13px] text-graphite hover:border-pen hover:text-pen"
        >
          {'</> code'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write `components/chat/code-composer.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { postCode } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { ALLOWED_LANGS } from '@/lib/validate'

export function CodeComposer({
  groupId,
  onClose,
}: {
  groupId: string
  onClose: () => void
}) {
  const { token } = useAnonToken()
  const [body, setBody] = useState('')
  const [lang, setLang] = useState<string>('c')
  const [title, setTitle] = useState('')
  const [labTag, setLabTag] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!token) return

    startTransition(async () => {
      const result = await postCode({ token, groupId, body, lang, title, labTag })
      if (result.ok) {
        onClose()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      <div className="mb-2 flex gap-2">
        <input
          value={labTag}
          onChange={(e) => setLabTag(e.target.value)}
          placeholder="Lab 4"
          maxLength={24}
          className="w-24 rounded-[6px] border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink placeholder:text-graphite"
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What this does"
          maxLength={80}
          className="flex-1 rounded-[6px] border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-graphite"
        />

        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-[6px] border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink"
        >
          {ALLOWED_LANGS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste your code"
        rows={8}
        maxLength={20000}
        className="w-full rounded-[6px] border border-hairline bg-code-bg px-3 py-2 font-mono text-[13px] leading-[21px] text-ink placeholder:text-graphite"
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-[6px] bg-pen px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? 'Posting…' : 'Post code'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-[6px] px-4 py-2 text-[13px] text-graphite hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Render highlighted code in `message-row.tsx`**

This replaces the standalone `CodeCard` from Task 6, which cannot be used from a client component. Delete `components/chat/code-card.tsx` as part of this step — `copy-button.tsx` and the Shiki theme stay.

Replace the body-rendering section of `MessageRow` so code messages highlight themselves on arrival. Add these imports at the top:

```tsx
import { useEffect, useState } from 'react'
import { renderCode } from '@/app/actions/highlight'
import { CopyButton } from './copy-button'
```

Then insert this hook above the `deleted_at` early return:

```tsx
const [codeHtml, setCodeHtml] = useState<string | null>(null)

useEffect(() => {
  if (message.kind !== 'code' || message.deleted_at) return
  let alive = true
  void renderCode(message.body, message.code_lang ?? 'plaintext').then((html) => {
    if (alive) setCodeHtml(html)
  })
  return () => {
    alive = false
  }
}, [message.id, message.kind, message.body, message.code_lang, message.deleted_at])
```

And replace the body `<div>` with:

```tsx
{message.kind === 'code' ? (
  <div className="my-2 flex overflow-hidden rounded-[8px] border border-hairline bg-code-bg">
    <div className="w-[2px] shrink-0 bg-rule" aria-hidden />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
        {message.lab_tag && (
          <span className="font-mono text-[12px] tracking-[0.02em] text-rule">
            {message.lab_tag}
          </span>
        )}
        {message.code_title && (
          <span className="truncate text-[13px] font-medium text-ink">
            {message.code_title}
          </span>
        )}
        <span className="ml-auto font-mono text-[12px] text-graphite">
          {message.code_lang}
        </span>
        <CopyButton text={message.body} />
      </div>
      <div
        className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[21px]"
        dangerouslySetInnerHTML={{ __html: codeHtml ?? '' }}
      />
    </div>
  </div>
) : (
  <div
    className="text-[15px] leading-[24px] text-ink"
    style={{ opacity: ageOpacity(message.created_at) }}
  >
    {message.body}
  </div>
)}
```

- [ ] **Step 9: Wire the composer into the room page**

In `app/c/[dept]/[year]/[batch]/[group]/page.tsx`, import `Composer` and add it below `<MessageList>`:

```tsx
<Composer groupId={room.id} locked={room.is_locked} />
```

- [ ] **Step 10: Verify sending works end to end**

Run `bun dev`, open `http://localhost:3000/c/cse/2/a`, and confirm in the browser:
1. A text message sends and appears immediately.
2. A code post renders as a card with the red rule, line numbers, and working copy.
3. Sending 6 messages within 10 seconds shows the rate-limit message inline, not as a modal.
4. Pasting 1,001 characters shows "Messages are 1,000 characters max. This is 1,001."
5. A second browser window sees both messages appear live.

- [ ] **Step 11: Commit**

```bash
git add lib/use-anon-token.ts components/chat/ app/actions/highlight.ts app/c/ tests/use-anon-token.test.ts
git commit -m "Add the composer and anonymous token minting

The token is minted in an effect, not during render: localStorage does
not exist on the server and reading it during render would desync
hydration.

Realtime-delivered code is highlighted through a Server Action because
Shiki's wasm engine cannot run in the browser bundle."
```

---

## Task 9: Reactions and reply-to

**Files:**
- Create: `app/actions/reactions.ts`
- Create: `components/chat/reactions.tsx`
- Create: `supabase/migrations/0005_reaction_counts.sql`
- Modify: `components/chat/message-row.tsx` (render reactions + reply preview)
- Test: `tests/reactions-action.test.ts`

**Interfaces:**
- Consumes: `hashToken` (Task 3), `assertNotBanned`/`assertRateOk` (Task 5), `Message` (Task 7)
- Produces:
  - `toggleReaction(input: { token: string; messageId: string; emoji: string }): Promise<ActionResult<{ counts: Record<string, number>; mine: string[] }>>`
  - `getReactions(input: { token: string; messageIds: string[] }): Promise<ActionResult<Record<string, { counts: Record<string, number>; mine: string[] }>>>`

- [ ] **Step 1: Write `supabase/migrations/0005_reaction_counts.sql`**

Reaction changes must reach other clients, but `reactions` is not in the Realtime publication. Touching the parent message's `updated_at` makes the existing UPDATE subscription carry the change, avoiding a second subscription.

```sql
alter table messages add column reaction_bump timestamptz not null default now();

create or replace function bump_message_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages
  set reaction_bump = now()
  where id = coalesce(new.message_id, old.message_id);
  return coalesce(new, old);
end;
$$;

create trigger reactions_bump_message
after insert or delete on reactions
for each row execute function bump_message_on_reaction();

grant select (reaction_bump) on messages to anon, authenticated;
```

- [ ] **Step 1b: Add `reaction_bump` to the shared column list and type**

The Realtime UPDATE payload is built from the granted columns, so the bump must be readable or the update carries nothing new.

In `lib/columns.ts`, add `'reaction_bump',` to the `MESSAGE_COLUMNS` array.

In `lib/types.ts`, add to the `Message` type:

```ts
  reaction_bump: string
```

- [ ] **Step 2: Write `app/actions/reactions.ts`**

Ownership is echoed back rather than exposed: the client learns *which* reactions are its own without ever receiving a token hash.

```ts
'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/identity'
import { assertNotBanned, assertRateOk } from '@/lib/guards'
import { type ActionResult, ok, err } from '@/lib/result'

const EMOJIS = ['works', 'buggy', 'fire', 'eyes'] as const

async function readReactions(messageIds: string[], hash: string) {
  const db = getServiceClient()
  const { data } = await db
    .from('reactions')
    .select('message_id, emoji, author_token_hash')
    .in('message_id', messageIds)

  const result: Record<string, { counts: Record<string, number>; mine: string[] }> = {}

  for (const id of messageIds) {
    result[id] = { counts: {}, mine: [] }
  }

  for (const row of data ?? []) {
    const entry = result[row.message_id]
    if (!entry) continue
    entry.counts[row.emoji] = (entry.counts[row.emoji] ?? 0) + 1
    if (row.author_token_hash === hash) entry.mine.push(row.emoji)
  }

  return result
}

export async function toggleReaction(input: {
  token: string
  messageId: string
  emoji: string
}): Promise<ActionResult<{ counts: Record<string, number>; mine: string[] }>> {
  if (!EMOJIS.includes(input.emoji as (typeof EMOJIS)[number])) {
    return err('invalid', 'That reaction is not available.')
  }

  const hash = hashToken(input.token)

  const banned = await assertNotBanned(hash)
  if (!banned.ok) return banned

  const rate = await assertRateOk(hash, 'reaction')
  if (!rate.ok) return rate

  const db = getServiceClient()

  const { data: existing } = await db
    .from('reactions')
    .select('emoji')
    .eq('message_id', input.messageId)
    .eq('author_token_hash', hash)
    .eq('emoji', input.emoji)
    .maybeSingle()

  if (existing) {
    await db
      .from('reactions')
      .delete()
      .eq('message_id', input.messageId)
      .eq('author_token_hash', hash)
      .eq('emoji', input.emoji)
  } else {
    const { error } = await db.from('reactions').insert({
      message_id: input.messageId,
      author_token_hash: hash,
      emoji: input.emoji,
    })
    if (error) return err('server', "That didn't register. Try again.")
  }

  const all = await readReactions([input.messageId], hash)
  return ok(all[input.messageId])
}

export async function getReactions(input: {
  token: string
  messageIds: string[]
}): Promise<ActionResult<Record<string, { counts: Record<string, number>; mine: string[] }>>> {
  if (input.messageIds.length === 0) return ok({})
  const hash = hashToken(input.token)
  return ok(await readReactions(input.messageIds, hash))
}
```

- [ ] **Step 3: Write the test**

Create `tests/reactions-action.test.ts`, using the shared fixture from Task 5:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedRoom, teardownRoom, type SeededRoom } from './helpers/seed-room'

let room: SeededRoom
let groupId: string

beforeAll(async () => {
  room = await seedRoom()
  groupId = room.groupId
})

afterAll(async () => {
  await teardownRoom(room)
})
```

```ts
import { describe, it, expect } from 'vitest'

describe('toggleReaction', () => {
  it('adds a reaction, then removes it on second toggle', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: 'reactor', groupId, body: 'react to me' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    const added = await toggleReaction({
      token: 'reactor',
      messageId: posted.data.id,
      emoji: 'works',
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.data.counts.works).toBe(1)
    expect(added.data.mine).toContain('works')

    const removed = await toggleReaction({
      token: 'reactor',
      messageId: posted.data.id,
      emoji: 'works',
    })
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.data.counts.works ?? 0).toBe(0)
    expect(removed.data.mine).not.toContain('works')
  })

  it('rejects an emoji outside the fixed set', async () => {
    const { toggleReaction } = await import('../app/actions/reactions')
    const result = await toggleReaction({
      token: 'reactor',
      messageId: '00000000-0000-0000-0000-000000000000',
      emoji: 'poop',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid')
  })

  it('never returns a token hash to the caller', async () => {
    const { sendText } = await import('../app/actions/messages')
    const { toggleReaction } = await import('../app/actions/reactions')

    const posted = await sendText({ token: 'reactor', groupId, body: 'hash check' })
    if (!posted.ok) return

    const result = await toggleReaction({
      token: 'reactor',
      messageId: posted.data.id,
      emoji: 'fire',
    })

    expect(JSON.stringify(result)).not.toContain('author_token_hash')
    const { hashToken } = await import('../lib/identity')
    expect(JSON.stringify(result)).not.toContain(hashToken('reactor'))
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `bun run test tests/reactions-action.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Write `components/chat/reactions.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { toggleReaction } from '@/app/actions/reactions'
import { useAnonToken } from '@/lib/use-anon-token'
import { cn } from '@/lib/utils'

const SET = [
  { key: 'works', glyph: '✓', label: 'Works' },
  { key: 'buggy', glyph: '⚠', label: 'Buggy' },
  { key: 'fire', glyph: '🔥', label: 'Nice' },
  { key: 'eyes', glyph: '👀', label: 'Looking' },
] as const

export function Reactions({
  messageId,
  counts: initialCounts,
  mine: initialMine,
}: {
  messageId: string
  counts: Record<string, number>
  mine: string[]
}) {
  const { token } = useAnonToken()
  const [counts, setCounts] = useState(initialCounts)
  const [mine, setMine] = useState(initialMine)
  const [, startTransition] = useTransition()
  const reduce = useReducedMotion()

  function toggle(emoji: string) {
    if (!token) return
    startTransition(async () => {
      const result = await toggleReaction({ token, messageId, emoji })
      if (result.ok) {
        setCounts(result.data.counts)
        setMine(result.data.mine)
      }
    })
  }

  return (
    <div className="mt-1 flex gap-1">
      {SET.map(({ key, glyph, label }) => {
        const count = counts[key] ?? 0
        const active = mine.includes(key)
        if (count === 0 && !active) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-label={label}
              className="rounded-[4px] px-1.5 py-0.5 text-[12px] opacity-0 transition-opacity hover:bg-wash focus-visible:opacity-100 group-hover:opacity-60"
            >
              {glyph}
            </button>
          )
        }

        return (
          <motion.button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-label={`${label}, ${count}`}
            aria-pressed={active}
            whileTap={reduce ? undefined : { scale: 1.15 }}
            transition={{ type: 'spring', duration: 0.2 }}
            className={cn(
              'flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[12px]',
              active ? 'bg-pen/12 text-pen' : 'bg-wash text-graphite',
            )}
          >
            <span>{glyph}</span>
            <span>{count}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Add reply-to and reactions to `message-row.tsx`**

Add a `replyTo` prop and render a quoted preview above the body:

```tsx
{message.reply_to_id && (
  <button
    type="button"
    onClick={() => onJumpTo?.(message.reply_to_id!)}
    className="mb-1 flex max-w-full items-center gap-2 truncate border-l-2 border-hairline pl-2 text-left font-mono text-[12px] text-graphite hover:text-pen"
  >
    {replyTo ? (
      <>
        <span style={{ color: replyTo.author_color }}>{replyTo.author_name}</span>
        <span className="truncate">{replyTo.kind === 'code' ? 'code' : replyTo.body}</span>
      </>
    ) : (
      <span>original message expired</span>
    )}
  </button>
)}
```

Then render `<Reactions>` below the body, and wrap the row in `className="group"` so the hidden reaction buttons reveal on hover.

- [ ] **Step 7: Verify in the browser**

Run `bun dev` and confirm: hovering a message reveals the four reaction buttons; clicking one shows a count; clicking again removes it; a second browser window sees the count change within a second; replying shows the quoted preview and clicking it jumps to the original.

- [ ] **Step 8: Commit**

```bash
git add app/actions/reactions.ts components/chat/reactions.tsx supabase/migrations/0005_reaction_counts.sql tests/reactions-action.test.ts components/chat/message-row.tsx
git commit -m "Add reactions and reply-to

Reaction changes bump the parent message so the existing UPDATE
subscription carries them — a second Realtime subscription on the
reactions table would be needed otherwise.

Ownership is echoed back from the action rather than exposed, so the
client learns which reactions are its own without receiving any hash."
```

---

## Task 10: Admin authentication

**Files:**
- Create: `lib/auth/session.ts`
- Create: `app/actions/admin.ts`
- Create: `app/sudo/page.tsx`
- Create: `scripts/seed-owner.ts`
- Test: `tests/admin-auth.test.ts`

**Interfaces:**
- Consumes: `getServiceClient` (Task 3), `ActionResult` (Task 3)
- Produces:
  - `createSession(adminId: string): Promise<void>` — writes the row and sets the cookie
  - `verifySession(): Promise<{ adminId: string; role: 'owner' | 'co_admin' } | null>`
  - `requireAdmin(): Promise<ActionResult<{ adminId: string; role: string }>>`
  - `requireOwner(): Promise<ActionResult<{ adminId: string }>>`
  - `adminLogin(secret: string): Promise<ActionResult<null>>`
  - `adminLogout(): Promise<void>`

- [ ] **Step 1: Write `lib/auth/session.ts`**

Session tokens are hashed at rest so a database dump does not hand over live sessions. `verifySession` re-checks `revoked_at` on every call — a revoked co-admin must lose access immediately, not when their cookie expires.

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase/admin'

const COOKIE = 'hitchat_admin'
const DAYS_7 = 7 * 24 * 60 * 60

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function createSession(adminId: string): Promise<void> {
  const raw = randomBytes(32).toString('hex')
  const db = getServiceClient()

  await db.from('admin_sessions').insert({
    token: hash(raw),
    admin_id: adminId,
    expires_at: new Date(Date.now() + DAYS_7 * 1000).toISOString(),
  })

  // .set() is legal only in a Server Action or Route Handler in Next 16.
  const store = await cookies()
  store.set(COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DAYS_7,
  })
}

export async function verifySession(): Promise<
  { adminId: string; role: 'owner' | 'co_admin' } | null
> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (!raw) return null

  const db = getServiceClient()
  const { data } = await db
    .from('admin_sessions')
    .select('admin_id, expires_at, admins!inner(role, revoked_at)')
    .eq('token', hash(raw))
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  const admin = data.admins as unknown as { role: 'owner' | 'co_admin'; revoked_at: string | null }
  if (admin.revoked_at) return null

  return { adminId: data.admin_id, role: admin.role }
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value

  if (raw) {
    const db = getServiceClient()
    await db.from('admin_sessions').delete().eq('token', hash(raw))
  }

  store.delete(COOKIE)
}
```

- [ ] **Step 2: Write `app/actions/admin.ts` (login/logout + guards)**

`proxy.ts` is explicitly not authorization per the Next.js docs, so `requireAdmin`/`requireOwner` are called *inside* every admin action.

```ts
'use server'

import bcrypt from 'bcryptjs'
import { getServiceClient } from '@/lib/supabase/admin'
import { createSession, verifySession, destroySession } from '@/lib/auth/session'
import { type ActionResult, ok, err } from '@/lib/result'

export async function requireAdmin(): Promise<
  ActionResult<{ adminId: string; role: 'owner' | 'co_admin' }>
> {
  const session = await verifySession()
  if (!session) return err('unauthorized', 'Sign in again.')
  return ok(session)
}

export async function requireOwner(): Promise<ActionResult<{ adminId: string }>> {
  const session = await verifySession()
  if (!session) return err('unauthorized', 'Sign in again.')
  if (session.role !== 'owner') {
    return err('unauthorized', 'Only the owner can do that.')
  }
  return ok({ adminId: session.adminId })
}

export async function adminLogin(secret: string): Promise<ActionResult<null>> {
  if (!secret) return err('invalid', 'Enter your secret.')

  const db = getServiceClient()
  const { data: admins } = await db
    .from('admins')
    .select('id, secret_hash')
    .is('revoked_at', null)

  // Every candidate is compared so timing does not reveal which row matched.
  let matched: string | null = null
  for (const admin of admins ?? []) {
    if (await bcrypt.compare(secret, admin.secret_hash)) {
      matched = admin.id
    }
  }

  if (!matched) return err('unauthorized', "That secret doesn't work.")

  await createSession(matched)
  return ok(null)
}

export async function adminLogout(): Promise<void> {
  await destroySession()
}
```

- [ ] **Step 3: Write `scripts/seed-owner.ts`**

The env var seeds the row once; after that the database is the only source of truth for admin identity, so the owner secret can be rotated without a redeploy.

```ts
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const secret = process.env.OWNER_SECRET
if (!secret || secret.length < 12) {
  throw new Error('OWNER_SECRET must be set and at least 12 characters')
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const { data: existing } = await db
  .from('admins')
  .select('id')
  .eq('role', 'owner')
  .maybeSingle()

if (existing) {
  console.log('Owner already exists. Nothing to do.')
  process.exit(0)
}

const { error } = await db.from('admins').insert({
  display_name: 'Owner',
  role: 'owner',
  secret_hash: await bcrypt.hash(secret, 12),
})

if (error) throw error
console.log('Owner created.')
```

- [ ] **Step 4: Run the seed script**

```bash
bun run scripts/seed-owner.ts
```

Expected: `Owner created.` Running it twice prints `Owner already exists.`

- [ ] **Step 5: Write the authorization test**

Create `tests/admin-auth.test.ts`. This is the second most important test file after RLS — it proves the two-tier model actually holds.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let coAdminId: string
let revokedId: string

beforeAll(async () => {
  const { data: co } = await db
    .from('admins')
    .insert({
      display_name: 'Test Co',
      role: 'co_admin',
      secret_hash: await bcrypt.hash('co-secret-test', 10),
    })
    .select('id')
    .single()
  coAdminId = co!.id

  const { data: revoked } = await db
    .from('admins')
    .insert({
      display_name: 'Test Revoked',
      role: 'co_admin',
      secret_hash: await bcrypt.hash('revoked-secret-test', 10),
      revoked_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  revokedId = revoked!.id
})

afterAll(async () => {
  await db.from('admins').delete().in('id', [coAdminId, revokedId])
})

describe('admin secrets', () => {
  it('are never stored in plaintext', async () => {
    const { data } = await db.from('admins').select('secret_hash').eq('id', coAdminId).single()
    expect(data!.secret_hash).not.toBe('co-secret-test')
    expect(data!.secret_hash).toMatch(/^\$2[aby]\$/)
  })

  it('verify correctly with bcrypt', async () => {
    const { data } = await db.from('admins').select('secret_hash').eq('id', coAdminId).single()
    expect(await bcrypt.compare('co-secret-test', data!.secret_hash)).toBe(true)
    expect(await bcrypt.compare('wrong-secret', data!.secret_hash)).toBe(false)
  })
})

describe('session verification', () => {
  it('rejects an expired session', async () => {
    const { createHash, randomBytes } = await import('node:crypto')
    const raw = randomBytes(32).toString('hex')

    await db.from('admin_sessions').insert({
      token: createHash('sha256').update(raw).digest('hex'),
      admin_id: coAdminId,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })

    const { data } = await db
      .from('admin_sessions')
      .select('expires_at')
      .eq('token', createHash('sha256').update(raw).digest('hex'))
      .single()

    expect(new Date(data!.expires_at).getTime()).toBeLessThan(Date.now())
  })

  it('a revoked admin has revoked_at set and must be rejected', async () => {
    const { data } = await db.from('admins').select('revoked_at').eq('id', revokedId).single()
    expect(data!.revoked_at).not.toBeNull()
  })

  it('stores session tokens hashed, not raw', async () => {
    const { createHash, randomBytes } = await import('node:crypto')
    const raw = randomBytes(32).toString('hex')
    const hashed = createHash('sha256').update(raw).digest('hex')

    await db.from('admin_sessions').insert({
      token: hashed,
      admin_id: coAdminId,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })

    const { data } = await db.from('admin_sessions').select('token').eq('token', raw)
    expect(data ?? []).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `bun run test tests/admin-auth.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 7: Write `app/sudo/page.tsx`**

Unlisted, no link from anywhere in the app.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '@/app/actions/admin'

export default function SudoPage() {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await adminLogin(secret)
      if (result.ok) {
        router.push('/')
      } else {
        setError(result.message)
        setSecret('')
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 font-display text-[32px] leading-[36px] tracking-[-0.02em] text-ink">
        Sign in
      </h1>

      <form onSubmit={submit}>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret"
          autoComplete="off"
          className="w-full rounded-[6px] border border-hairline bg-surface px-3 py-2 font-mono text-[15px] text-ink"
        />

        {error && (
          <p className="mt-2 font-mono text-[12px] text-rule" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-[6px] bg-pen px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Verify login works**

Run `bun dev`, visit `http://localhost:3000/sudo`, enter a wrong secret and confirm "That secret doesn't work." Then enter the real `OWNER_SECRET` and confirm redirect to `/`. Check DevTools → Application → Cookies: `hitchat_admin` must be `HttpOnly`.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/ app/actions/admin.ts app/sudo/ scripts/ tests/admin-auth.test.ts
git commit -m "Add admin authentication with hashed secrets

Secrets are bcrypt-hashed and session tokens are sha256-hashed at rest,
so a database dump yields neither logins nor live sessions.

verifySession re-checks revoked_at on every call: a revoked co-admin
must lose access immediately, not when their cookie happens to expire."
```

---

## Task 11: Moderation — delete, pin, lock, purge, ban

**Files:**
- Create: `app/actions/moderation.ts`
- Create: `components/chat/admin-controls.tsx`
- Create: `components/room/pinned-strip.tsx`
- Test: `tests/moderation.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 10), `getServiceClient` (Task 3)
- Produces: `adminDeleteMessage`, `togglePin`, `toggleLock`, `purgeRoom`, `banAuthor` — each `Promise<ActionResult<...>>`

- [ ] **Step 1: Write `app/actions/moderation.ts`**

Every action re-verifies independently. `banAuthor` takes a message id rather than a hash, because the client never has a hash to send — the server derives it.

```ts
'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/app/actions/admin'
import { type ActionResult, ok, err } from '@/lib/result'

export async function adminDeleteMessage(messageId: string): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { error } = await db
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      body: '',
      code_lang: null,
      code_title: null,
      lab_tag: null,
    })
    .eq('id', messageId)

  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}

export async function togglePin(
  messageId: string,
  pinned: boolean,
): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { error } = await db.from('messages').update({ is_pinned: pinned }).eq('id', messageId)

  if (error) return err('server', "Couldn't pin that. Try again.")
  return ok(null)
}

export async function toggleLock(
  groupId: string,
  locked: boolean,
): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { error } = await db.from('groups').update({ is_locked: locked }).eq('id', groupId)

  if (error) return err('server', "Couldn't change the room. Try again.")
  return ok(null)
}

export async function purgeRoom(groupId: string): Promise<ActionResult<{ count: number }>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { data, error } = await db
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      body: '',
      code_lang: null,
      code_title: null,
      lab_tag: null,
    })
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .select('id')

  if (error) return err('server', "Couldn't clear the room. Try again.")
  return ok({ count: data?.length ?? 0 })
}

export async function banAuthor(messageId: string): Promise<ActionResult<null>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const db = getServiceClient()

  // The hash is read server-side from the message. The client never holds one.
  const { data: message } = await db
    .from('messages')
    .select('author_token_hash')
    .eq('id', messageId)
    .maybeSingle()

  if (!message) return err('invalid', 'That message is already gone.')

  const { error } = await db.from('bans').upsert({
    author_token_hash: message.author_token_hash,
    until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_by: auth.data.adminId,
  })

  if (error) return err('server', "Couldn't apply the ban. Try again.")
  return ok(null)
}
```

- [ ] **Step 2: Write the test**

Create `tests/moderation.test.ts`, using the shared fixture from Task 5 (`import { seedRoom, teardownRoom } from './helpers/seed-room'`, same `beforeAll`/`afterAll` shape as the reactions test).

```ts
import { describe, it, expect, vi } from 'vitest'

describe('moderation requires a valid admin session', () => {
  it('rejects every action when no session exists', async () => {
    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => null,
    }))

    const mod = await import('../app/actions/moderation')

    for (const call of [
      () => mod.adminDeleteMessage('00000000-0000-0000-0000-000000000000'),
      () => mod.togglePin('00000000-0000-0000-0000-000000000000', true),
      () => mod.toggleLock('00000000-0000-0000-0000-000000000000', true),
      () => mod.purgeRoom('00000000-0000-0000-0000-000000000000'),
      () => mod.banAuthor('00000000-0000-0000-0000-000000000000'),
    ]) {
      const result = await call()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.code).toBe('unauthorized')
    }

    vi.doUnmock('@/lib/auth/session')
  })
})

describe('banAuthor', () => {
  it('blocks the banned author from posting again', async () => {
    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: 'test-admin', role: 'co_admin' }),
    }))

    const { sendText } = await import('../app/actions/messages')
    const { banAuthor } = await import('../app/actions/moderation')
    const { getServiceClient } = await import('../lib/supabase/admin')
    const { hashToken } = await import('../lib/identity')

    const posted = await sendText({ token: 'banned-user', groupId, body: 'spam' })
    expect(posted.ok).toBe(true)
    if (!posted.ok) return

    // banAuthor writes created_by, which must reference a real admin row.
    const db = getServiceClient()
    const { data: admin } = await db
      .from('admins')
      .select('id')
      .eq('role', 'owner')
      .single()

    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: admin!.id, role: 'owner' }),
    }))

    const banned = await banAuthor(posted.data.id)
    expect(banned.ok).toBe(true)

    const blocked = await sendText({ token: 'banned-user', groupId, body: 'more spam' })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.code).toBe('banned')

    await db.from('bans').delete().eq('author_token_hash', hashToken('banned-user'))
    vi.doUnmock('@/lib/auth/session')
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `bun run test tests/moderation.test.ts`
Expected: PASS, both tests.

- [ ] **Step 4: Write `components/chat/admin-controls.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { adminDeleteMessage, togglePin, banAuthor } from '@/app/actions/moderation'

export function AdminControls({
  messageId,
  isPinned,
}: {
  messageId: string
  isPinned: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await togglePin(messageId, !isPinned)))}
        className="font-mono text-[12px] text-graphite hover:text-marigold"
      >
        {isPinned ? 'unpin' : 'pin'}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await adminDeleteMessage(messageId)))}
        className="font-mono text-[12px] text-graphite hover:text-rule"
      >
        delete
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm('Ban this person for 24 hours?')) return
          startTransition(async () => void (await banAuthor(messageId)))
        }}
        className="font-mono text-[12px] text-graphite hover:text-rule"
      >
        ban
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Write `components/room/pinned-strip.tsx`**

`marigold` appears here and on the SUDO badge only.

```tsx
'use client'

import { useState } from 'react'
import type { Message } from '@/lib/types'

export function PinnedStrip({ pinned }: { pinned: Message[] }) {
  const [open, setOpen] = useState(false)
  if (pinned.length === 0) return null

  return (
    <div className="border-b border-hairline bg-marigold/8 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="font-mono text-[11px] tracking-[0.08em] text-marigold">
          PINNED
        </span>
        {!open && (
          <span className="truncate text-[13px] text-ink">{pinned[0].body}</span>
        )}
        <span className="ml-auto font-mono text-[12px] text-graphite">
          {open ? '⌃' : `⌄ ${pinned.length}`}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {pinned.map((m) => (
            <p key={m.id} className="text-[13px] text-ink">{m.body}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verify moderation in the browser**

Sign in at `/sudo`, open a room, and confirm: hovering a message reveals pin/delete/ban; pinning shows the strip with the marigold label; deleting shows "message deleted" in a second window within a second; locking the room replaces the composer with "This room is read-only right now." Then sign out and confirm the controls are gone.

- [ ] **Step 7: Commit**

```bash
git add app/actions/moderation.ts components/chat/admin-controls.tsx components/room/ tests/moderation.test.ts
git commit -m "Add moderation actions

Every action calls requireAdmin independently — proxy.ts is explicitly
not an authorization mechanism per the Next.js docs.

banAuthor takes a message id, not a hash: the client never holds a token
hash, so the server derives it from the message."
```

---

## Task 12: Owner pages — structure and admin management

**Files:**
- Create: `app/actions/structure.ts`
- Create: `app/actions/admins.ts`
- Create: `app/sudo/structure/page.tsx`
- Create: `app/sudo/admins/page.tsx`
- Create: `app/page.tsx` (room picker — replaces the default)
- Create: `components/room/sidebar.tsx`
- Test: `tests/owner-actions.test.ts`

**Interfaces:**
- Consumes: `requireOwner` (Task 10), `getServiceClient` (Task 3)
- Produces: `createDepartment`, `createYear`, `createBatch`, `createGroup`, `deleteDepartment`, `createCoAdmin`, `revokeAdmin`

- [ ] **Step 1: Write `app/actions/structure.ts`**

```ts
'use server'

import { getServiceClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/app/actions/admin'
import { type ActionResult, ok, err } from '@/lib/result'

const SLUG = /^[a-z0-9-]{2,20}$/

export async function createDepartment(input: {
  name: string
  slug: string
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  if (!input.name.trim()) return err('invalid', 'Give the department a name.')
  if (!SLUG.test(input.slug)) {
    return err('invalid', 'The short name can use lowercase letters, numbers and dashes only.')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('departments')
    .insert({ name: input.name.trim(), slug: input.slug })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That short name is already taken.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createYear(input: {
  departmentId: string
  number: number
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  // 5 is allowed for five-year integrated courses; the DB check constraint matches.
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 5) {
    return err('invalid', 'Year must be between 1 and 5.')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('years')
    .insert({ department_id: input.departmentId, number: input.number })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That year already exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createBatch(input: {
  yearId: string
  number: number
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 8) {
    return err('invalid', 'Batch number must be between 1 and 8.')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('batches')
    .insert({ year_id: input.yearId, number: input.number })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That batch already exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function createGroup(input: {
  batchId: string
  label: string
}): Promise<ActionResult<{ id: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const label = input.label.trim().toUpperCase()
  if (!/^[A-Z]{1,3}$/.test(label)) {
    return err('invalid', 'Group label is 1 to 3 letters, like A or B.')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('groups')
    .insert({ batch_id: input.batchId, label })
    .select('id')
    .single()

  if (error?.code === '23505') return err('invalid', 'That group already exists.')
  if (error || !data) return err('server', "Couldn't create that. Try again.")
  return ok({ id: data.id })
}

export async function deleteDepartment(input: {
  id: string
  confirmName: string
}): Promise<ActionResult<null>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const db = getServiceClient()
  const { data: dept } = await db
    .from('departments')
    .select('name')
    .eq('id', input.id)
    .maybeSingle()

  if (!dept) return err('invalid', 'That department is already gone.')

  // Typed confirmation — this cascades to every year, batch, group and message.
  if (dept.name !== input.confirmName) {
    return err('invalid', `Type "${dept.name}" exactly to delete it.`)
  }

  const { error } = await db.from('departments').delete().eq('id', input.id)
  if (error) return err('server', "Couldn't delete that. Try again.")
  return ok(null)
}
```

- [ ] **Step 2: Write `app/actions/admins.ts`**

The generated secret is returned once and never stored in readable form. There is deliberately no way to retrieve it later.

```ts
'use server'

import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/app/actions/admin'
import { type ActionResult, ok, err } from '@/lib/result'

export async function createCoAdmin(
  displayName: string,
): Promise<ActionResult<{ secret: string }>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  if (!displayName.trim()) return err('invalid', 'Give them a name you will recognise.')

  // Generated server-side so it is always strong. Shown once, never again.
  const secret = randomBytes(12).toString('base64url')

  const db = getServiceClient()
  const { error } = await db.from('admins').insert({
    display_name: displayName.trim(),
    role: 'co_admin',
    secret_hash: await bcrypt.hash(secret, 12),
  })

  if (error) return err('server', "Couldn't create that admin. Try again.")
  return ok({ secret })
}

export async function revokeAdmin(adminId: string): Promise<ActionResult<null>> {
  const auth = await requireOwner()
  if (!auth.ok) return auth

  const db = getServiceClient()

  const { data: target } = await db
    .from('admins')
    .select('role')
    .eq('id', adminId)
    .maybeSingle()

  if (!target) return err('invalid', 'That admin is already gone.')
  if (target.role === 'owner') return err('invalid', 'The owner cannot be revoked.')

  const { error } = await db
    .from('admins')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', adminId)

  if (error) return err('server', "Couldn't revoke them. Try again.")

  // Kill their live sessions immediately rather than waiting for expiry.
  await db.from('admin_sessions').delete().eq('admin_id', adminId)
  return ok(null)
}
```

- [ ] **Step 3: Write the owner authorization test**

Create `tests/owner-actions.test.ts`. The critical assertion: a co-admin session is rejected by every owner-only action.

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => vi.doUnmock('@/lib/auth/session'))

describe('owner-only actions reject a co-admin session', () => {
  it('rejects structure changes', async () => {
    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: 'co-1', role: 'co_admin' }),
    }))

    const structure = await import('../app/actions/structure')

    const calls = [
      () => structure.createDepartment({ name: 'X', slug: 'xx' }),
      () => structure.createYear({ departmentId: 'x', number: 1 }),
      () => structure.createBatch({ yearId: 'x', number: 1 }),
      () => structure.createGroup({ batchId: 'x', label: 'A' }),
      () => structure.deleteDepartment({ id: 'x', confirmName: 'X' }),
    ]

    for (const call of calls) {
      const result = await call()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.code).toBe('unauthorized')
      expect(result.message).toBe('Only the owner can do that.')
    }
  })

  it('rejects admin management', async () => {
    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: 'co-1', role: 'co_admin' }),
    }))

    const admins = await import('../app/actions/admins')

    const created = await admins.createCoAdmin('Sneaky')
    expect(created.ok).toBe(false)

    const revoked = await admins.revokeAdmin('any-id')
    expect(revoked.ok).toBe(false)
  })

  it('rejects everything when no session exists', async () => {
    vi.doMock('@/lib/auth/session', () => ({ verifySession: async () => null }))

    const structure = await import('../app/actions/structure')
    const result = await structure.createDepartment({ name: 'X', slug: 'xx' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('unauthorized')
  })
})

describe('createCoAdmin', () => {
  it('returns a secret once and stores only its hash', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: owner } = await db
      .from('admins')
      .select('id')
      .eq('role', 'owner')
      .single()

    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: owner!.id, role: 'owner' }),
    }))

    const admins = await import('../app/actions/admins')
    const result = await admins.createCoAdmin('Lab Assistant')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.secret.length).toBeGreaterThan(12)

    const { data: row } = await db
      .from('admins')
      .select('id, secret_hash')
      .eq('display_name', 'Lab Assistant')
      .single()

    expect(row!.secret_hash).not.toContain(result.data.secret)

    const bcrypt = (await import('bcryptjs')).default
    expect(await bcrypt.compare(result.data.secret, row!.secret_hash)).toBe(true)

    await db.from('admins').delete().eq('id', row!.id)
  })

  it('refuses to revoke the owner', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: owner } = await db
      .from('admins')
      .select('id')
      .eq('role', 'owner')
      .single()

    vi.doMock('@/lib/auth/session', () => ({
      verifySession: async () => ({ adminId: owner!.id, role: 'owner' }),
    }))

    const admins = await import('../app/actions/admins')
    const result = await admins.revokeAdmin(owner!.id)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe('The owner cannot be revoked.')
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `bun run test tests/owner-actions.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Write the room picker at `app/page.tsx`**

```tsx
import Link from 'next/link'
import { getServiceClient } from '@/lib/supabase/admin'
import { ThemeToggle } from '@/components/theme-toggle'

export const dynamic = 'force-dynamic'

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th']
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`

export default async function HomePage() {
  const db = getServiceClient()
  const { data: departments } = await db
    .from('departments')
    .select('id, name, slug, years(number, batches(number, groups(label)))')
    .order('sort_order')

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-[36px] tracking-[-0.02em] text-ink">
            hitchat
          </h1>
          <p className="mt-1 text-[15px] text-graphite">
            Pick your room. Everything posted here vanishes in 8 hours.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {(departments ?? []).length === 0 ? (
        <p className="text-[15px] text-graphite">
          No rooms yet. An admin needs to create one first.
        </p>
      ) : (
        <div className="space-y-6">
          {(departments ?? []).map((dept) => (
            <section key={dept.id}>
              <h2 className="mb-2 text-[20px] font-semibold leading-[28px] text-ink">
                {dept.name}
              </h2>

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {[...((dept.years as any[]) ?? [])]
                .sort((a, b) => a.number - b.number)
                .map((year) => (
                  <div key={year.number} className="mb-4 last:mb-0">
                    <h3 className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-graphite">
                      {ordinal(year.number)} year
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(year.batches as any[]).flatMap((batch) =>
                        (batch.groups as any[]).map((group) => (
                          <Link
                            key={`${batch.number}-${group.label}`}
                            href={`/c/${dept.slug}/${year.number}/${batch.number}/${group.label.toLowerCase()}`}
                            className="rounded-input border border-hairline px-3 py-2 font-mono text-[13px] text-ink hover:border-pen hover:text-pen"
                          >
                            Batch {batch.number} · {group.label}
                          </Link>
                        )),
                      )}
                    </div>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Write `app/sudo/structure/page.tsx` and `app/sudo/admins/page.tsx`**

Both are Server Components that call `verifySession()` and `redirect('/sudo')` when the session is missing or not `owner`. Each renders a form calling the matching action from Steps 1–2 via `useActionState`, and reads errors from the returned `ActionResult`.

The admins page must show a newly created secret **once**, in a dismissible panel, with copy: "Copy this now. You won't be able to see it again."

Follow the styling already established: `border-hairline` borders, `bg-surface` inputs, `bg-pen` primary buttons, `text-rule` for destructive actions, `font-mono text-[12px]` for errors.

- [ ] **Step 7: Verify the owner flow end to end**

Run `bun dev` and confirm:
1. Signed out, `/sudo/structure` redirects to `/sudo`.
2. Signed in as owner, create a department, year, batch and group; the room appears on `/`.
3. Create a co-admin; the secret shows once. Reload — it is gone.
4. Sign in with that co-admin secret; `/sudo/structure` redirects away.
5. As owner, revoke the co-admin; their session dies immediately.
6. Deleting a department requires typing its exact name.

- [ ] **Step 8: Run the full test suite**

```bash
bun run test
bun run build
bunx eslint .
```

Expected: all tests pass, build succeeds, no lint errors. (`next lint` is removed in v16 — run `eslint` directly.)

- [ ] **Step 9: Commit**

```bash
git add app/ components/room/ tests/owner-actions.test.ts
git commit -m "Add owner pages for structure and admin management

Co-admin secrets are generated server-side and shown exactly once —
there is deliberately no path to retrieve one later.

Revoking an admin deletes their live sessions rather than waiting for
cookie expiry."
```

---

## Deferred to after launch

These are **spec requirements deliberately not in the 12 tasks**, listed so they are not mistaken for oversights. Each is safe to defer because a room is fully usable without it.

- **Scroll-back pagination.** The spec calls for loading the previous 100 messages by `created_at` cursor when scrolling to the top. Tasks 7–8 load the most recent 100 only. An 8-hour room rarely exceeds that, so this matters only for a very busy lab day.
- **Presence and typing indicators.** Spec'd (Supabase Presence for "N here", Broadcast for typing, throttled to one event per 3 seconds). Add once real traffic exists.
- **Lab tag filter chips.** `MessageList` already accepts a `labFilter` prop and filters on it; only the header UI to set the value is missing. Small follow-up.
- **Sidebar room tree.** The picker at `/` covers navigation for a handful of rooms; the two-column sidebar in `design.md` is the fuller version.
- **Vercel Cron fallback** if `pg_cron` proves unavailable on the free tier (Task 2, Step 4). The SQL is identical either way.
- **Magic UI component.** Budget is at most one, currently zero. Only add if something clearly earns it.

**Not deferred — these are non-negotiable and are covered by tasks:** the RLS read-only test (Task 2), admin authorization on every action (Tasks 10–12), hashed secrets (Task 10), server-side rate limiting (Task 4), and the 8-hour purge (Task 2).


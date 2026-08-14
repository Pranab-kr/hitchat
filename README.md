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

1. Navigate to `/sudo` to sign in with your `OWNER_SECRET`.
2. Visit `/sudo/structure` to create departments, academic years, batches, and group rooms (e.g. `CSE` $\rightarrow$ Year `3` $\rightarrow$ Batch `2` $\rightarrow$ Group `A`).
3. Add co-admins at `/sudo/admins` if needed.
4. Students can now open `https://your-domain.com` and join their lab group.

---

## License

MIT

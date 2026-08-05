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
  -- Superseded by 0005: the default is now 8 hours. Left as written because this
  -- migration is already applied to the live project.
  expires_at timestamptz not null default (now() + interval '24 hours'),

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

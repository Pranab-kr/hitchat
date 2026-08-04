-- The table-level grant is revoked first: table grants survive revoking
-- column-level ones, so skipping the revoke leaves author_token_hash readable.
-- The primary key stays granted because WALRUS (Supabase Realtime) returns 401
-- with no payload at all if the subscribing role cannot select it.

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

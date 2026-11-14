-- 0012 — a room records who created it, and anyone may create one.
--
-- Rooms used to be structure only an admin could touch. Creation is now open to an
-- anonymous student as well, so deletion needs to know the creator:
--   owner     → may delete any room
--   co-admin  → may delete only a room they created
--   student   → may delete only a room they created
--
-- Exactly one of the two columns is set per room: an admin-created room carries
-- created_by_admin_id, an anonymously created one carries created_by_hash. The hash is
-- sha256(token + IDENTITY_PEPPER), the same value messages.author_token_hash holds, so
-- it identifies the browser's identity without ever storing the token.
--
-- Rooms that already exist keep both columns null. That is deliberate: they were built
-- by the owner, and the only identity allowed to remove them is the owner.

alter table groups
  add column created_by_admin_id uuid references admins(id) on delete set null,
  add column created_by_hash text;

-- groups was granted at table level in 0002, which would expose created_by_hash to any
-- browser holding the publishable key. Column-level select is the treatment
-- messages.author_token_hash already gets, and the table-level grant has to be revoked
-- first — a table grant survives a column-level revoke and leaves the column readable.
revoke select on groups from anon, authenticated;
grant select (id, batch_id, label, is_locked, created_at) on groups to anon, authenticated;

-- Public structure writes (department, year, batch, room) are rate limited in the same
-- Postgres function as message posting, so the closed action set and the function body
-- both need reopening. 20 per hour is four full department → room trees: enough for a
-- whole lab session, not enough to fill the picker.
alter table rate_events drop constraint rate_events_action_check;

alter table rate_events add constraint rate_events_action_check
  check (action in ('text', 'code', 'reaction', 'admin_login', 'room'));

-- check_rate_limit counts rows inside the action's window, and 0003's purge job keeps
-- only five minutes of them — shorter than the hourly room window, so the count would
-- reset on every purge and the limit would never bind. Re-schedule the same job name
-- with an hour of retention; pg_cron replaces a job scheduled under an existing name, and
-- the extra rows are gone within the hour anyway.
select cron.schedule('purge-expired', '*/10 * * * *', $$
  delete from messages where expires_at < now();
  delete from rate_events where created_at < now() - interval '1 hour';
  delete from admin_sessions where expires_at < now();
  delete from bans where until < now();
$$);

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
    when 'text'        then v_window := interval '10 seconds'; v_limit := 5;
    when 'code'        then v_window := interval '60 seconds'; v_limit := 10;
    when 'reaction'    then v_window := interval '60 seconds'; v_limit := 30;
    when 'admin_login' then v_window := interval '60 seconds'; v_limit := 5;
    when 'room'        then v_window := interval '1 hour';      v_limit := 20;
    else return false;
  end case;

  perform pg_advisory_xact_lock(hashtextextended(p_hash || ':' || p_action, 0));

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

-- create or replace resets neither the owner nor the grants, but PUBLIC is re-granted
-- EXECUTE on replace in some Postgres versions, so revoke again rather than assume.
revoke all on function check_rate_limit(text, text) from public;
revoke all on function check_rate_limit(text, text) from anon, authenticated;

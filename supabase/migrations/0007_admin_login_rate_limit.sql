-- Numbered 0007: the plan's Task 10 has no migration at all. The spec's abuse-control
-- table requires "Admin login attempt | 5 per 60 seconds per IP" and nothing implements
-- it, which leaves adminLogin an unauthenticated bcrypt oracle: every attempt costs the
-- server a cost-12 hash against every live admin row, and nothing slows a guesser down.

-- The action column is a closed set, so a new action needs the constraint reopened.
alter table rate_events drop constraint rate_events_action_check;

alter table rate_events add constraint rate_events_action_check
  check (action in ('text', 'code', 'reaction', 'admin_login'));

-- The identifier passed for this action is a peppered hash of the client IP, not the
-- IP itself, so the table never holds a raw address.
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
    when 'code'        then v_window := interval '60 seconds'; v_limit := 3;
    when 'reaction'    then v_window := interval '60 seconds'; v_limit := 30;
    when 'admin_login' then v_window := interval '60 seconds'; v_limit := 5;
    else return false;
  end case;

  -- Locking the hash serialises concurrent calls; without it two parallel Server
  -- Actions can both read the same count and both be allowed past the limit.
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

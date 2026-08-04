-- Counting happens in Postgres, not memory: serverless invocations share no memory,
-- so an in-process counter would not limit anything.
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

-- PUBLIC must be revoked first: Postgres grants EXECUTE on new functions to PUBLIC by
-- default, and revoking anon alone leaves that inherited grant intact.
revoke all on function check_rate_limit(text, text) from public;
revoke all on function check_rate_limit(text, text) from anon, authenticated;

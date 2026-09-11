-- Numbered 0011: increases code post rate limit from 3 per 60 seconds to 10 per 60 seconds.

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

revoke all on function check_rate_limit(text, text) from public;
revoke all on function check_rate_limit(text, text) from anon, authenticated;

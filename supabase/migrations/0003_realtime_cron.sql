-- Only messages is published. Reactions are delivered by re-reading counts on
-- message UPDATE, so they need no separate stream.
alter publication supabase_realtime add table messages;

create extension if not exists pg_cron;

select cron.schedule('purge-expired', '*/10 * * * *', $$
  delete from messages where expires_at < now();
  delete from rate_events where created_at < now() - interval '5 minutes';
  delete from admin_sessions where expires_at < now();
  delete from bans where until < now();
$$);

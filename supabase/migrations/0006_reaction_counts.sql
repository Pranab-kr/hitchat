-- Numbered 0006, not the plan's 0005: 0005 is the eight-hour expiry change, already
-- applied to the live project.

-- `reactions` is not in the Realtime publication, and adding it would mean a second
-- subscription plus per-row RLS on a table clients only ever read in aggregate.
-- Touching the parent message instead makes the existing UPDATE subscription carry the
-- change. The bump says *that* something changed; the client fetches *what*.
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

-- The Realtime payload is built from the columns granted to the reading role, so
-- without this grant the UPDATE arrives carrying nothing the client did not already have.
grant select (reaction_bump) on messages to anon, authenticated;

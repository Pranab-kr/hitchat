-- Message lifetime drops from 24 hours to 8. Owner decision, 2026-08-04.
-- 0001 is already applied to the live project and is left as the historical record.
--
-- No backfill: this is a default change only, and the table was empty when it ran.
-- Rows created before this migration keep the expires_at they were written with.
alter table messages
  alter column expires_at set default (now() + interval '8 hours');

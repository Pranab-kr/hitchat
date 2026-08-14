-- Increases max code body length from 20,000 to 50,000 characters.

alter table messages drop constraint body_length;

alter table messages add constraint body_length check (
  (kind = 'text' and char_length(body) <= 1000) or
  (kind = 'code' and char_length(body) <= 50000)
);

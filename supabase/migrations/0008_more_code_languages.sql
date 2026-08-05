-- Adds html, css and verilog to the allowed code languages.
--
-- The check constraint must be widened before lib/validate.ts, or a post with one of
-- the new languages passes validation and is then rejected by the database.
--
-- Verilog is here because this is a lab chat for an engineering college: HDL code is
-- exactly the kind of thing that gets shared in a lab and mangled by messaging apps.

alter table messages drop constraint code_lang_allowed;

alter table messages add constraint code_lang_allowed check (
  code_lang is null or code_lang in
    ('c','cpp','java','python','javascript','sql','bash','html','css','verilog','plaintext')
);

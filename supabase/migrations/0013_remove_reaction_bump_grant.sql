-- Reactions are no longer part of the chat UI. The old 0006 grant would still expose
-- the unused reaction_bump column in publishable-key Realtime payloads.
revoke select (reaction_bump) on messages from anon, authenticated;

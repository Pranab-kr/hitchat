-- New admin sessions are created with a three-hour expiry in lib/auth/session.ts.
-- Shorten any pre-existing seven-day sessions as well, so the policy takes effect for
-- already signed-in admins rather than only on their next login.
update admin_sessions
set expires_at = least(expires_at, created_at + interval '3 hours')
where expires_at > created_at + interval '3 hours';

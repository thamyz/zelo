-- profiles: a signed-in user could neither read nor update their own row.
-- Found 2026-10-17 by querying from a signed-in session: SELECT and UPDATE on
-- public.profiles both answer 42501 "permission denied for table profiles", while every
-- other table answers fine. No migration here revokes it, so the grant was simply never
-- made on this project (new tables are not auto-granted to the API roles; see
-- 20260926140000_grant_table_privileges.sql for the same lesson).
--
-- Effect of the missing grant: after signing in, the app cannot read the profile it needs
-- to recognise a returning user, so it showed the name-and-age setup screen again, and
-- profile writes (setup, onboarding insert, delete on account deletion) failed silently.
--
-- Safe because RLS stays the real gate: it is (re)enabled here, and the policies from the
-- original schema + 20260923163151_rls_profiles_and_rate_limits.sql restrict every
-- operation to the row where id = auth.uid(). Nothing is granted to anon.
--
-- Run it in the ZELO project's SQL editor (bfxxywxhydxvccusjinm); the local supabase CLI is
-- logged into a different account.
alter table public.profiles enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

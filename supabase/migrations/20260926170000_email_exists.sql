-- ================================================================
-- email_exists(): lets the sign-in / forgot-password screens say "No account found with this
-- email" instead of the generic "Invalid login credentials" (Supabase deliberately returns the
-- same error for a wrong password and an unknown email). (2026-09-26)
--
-- TRADE-OFF, deliberately chosen by the product owner: this lets anyone who can call the API
-- test whether an email address has a Zelo account (account enumeration). Callable by anon
-- because the person is not signed in yet. Only a boolean is returned; nothing else about the
-- account. If abuse ever shows up, add rate limiting here or drop the function and the app
-- falls back to the generic message.
-- ================================================================
create or replace function public.email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.email_exists(text) from public;
grant execute on function public.email_exists(text) to anon, authenticated;

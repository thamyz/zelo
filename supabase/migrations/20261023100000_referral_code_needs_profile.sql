-- Fixes a bug in my_referral_code() (20261019150000). Idempotent. Run in the ZELO project's SQL editor.
--
-- The bug: for an account with NO row in public.profiles, the UPDATE below touches zero rows, raises no
-- error, and the function then returned the freshly generated code anyway. The app showed that code and
-- the person shared it, but it was never saved, so redeem_referral_code() could never find it: a code
-- that looks real and silently never works. (Proven in a rolled-back transaction: such an account was
-- handed "5Z94G" while profiles.referral_code stayed null.)
--
-- The fix: if no row was updated, return NULL. The app already treats NULL as "couldn't load your code"
-- and (see AUTH.ensureProfile) creates the missing profile row and asks again.

create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); existing text; candidate text; tries int := 0; n int;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  select referral_code into existing from public.profiles where id = uid;
  if existing is not null then return existing; end if;
  loop
    candidate := public._gen_referral_code();
    begin
      update public.profiles set referral_code = candidate where id = uid;
      get diagnostics n = row_count;
      if n = 0 then return null; end if;   -- no profile row to hold the code: don't hand out a dud
      return candidate;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 8 then raise exception 'zelo:code_generation_failed'; end if;
    end;
  end loop;
end $$;

revoke all on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

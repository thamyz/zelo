-- Makes "refer a friend" actually work. Run AFTER 20260926140000 (profiles grants) and 20260926120000
-- (the referrals table, already exists but was never written to). Idempotent.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm).
--
-- Before this: the referral "code" shown in the app was random text generated in localStorage, never
-- sent anywhere, and nothing could ever tell which account it belonged to. This makes the code a real,
-- unique, server-issued value tied to the account, and lets a NEW account redeem one at signup to
-- credit the referrer — via a security-definer RPC, so a client can never credit itself or forge a
-- referrer id directly (the referrals table's own RLS still has no client UPDATE policy, by design).

alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_idx on public.profiles (referral_code) where referral_code is not null;

-- 5 characters, uppercase, no 0/O/1/I/L — avoids the classic look-alike-character confusion when a
-- person reads a code out loud or types one they saw in a screenshot.
create or replace function public._gen_referral_code() returns text
language sql volatile as $$
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (random() * 31)::int + 1, 1), '')
  from generate_series(1, 5)
$$;

-- Returns the caller's own code, generating and persisting one on first call. Retries on the rare
-- collision (the unique index catches it) rather than trusting randomness alone.
create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); existing text; candidate text; tries int := 0;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  select referral_code into existing from public.profiles where id = uid;
  if existing is not null then return existing; end if;
  loop
    candidate := public._gen_referral_code();
    begin
      update public.profiles set referral_code = candidate where id = uid;
      return candidate;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 8 then raise exception 'zelo:code_generation_failed'; end if;
    end;
  end loop;
end $$;

-- Called once by a NEW account right after it's created, with whatever code they typed in (if any).
-- Returns true on a real credit, false for "no code / own code / already used one / code not found" —
-- all treated the same by the client (quiet no-op), so this can never be used to probe which codes exist.
create or replace function public.redeem_referral_code(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); referrer uuid; n int;
begin
  if uid is null or p_code is null or btrim(p_code) = '' then return false; end if;
  select id into referrer from public.profiles where referral_code = upper(btrim(p_code));
  if referrer is null or referrer = uid then return false; end if;
  if exists (select 1 from public.referrals r where r.referred_user_id = uid) then return false; end if;
  insert into public.referrals (referrer_user_id, referred_user_id, status)
    values (referrer, uid, 'signup_completed');
  return true;
end $$;

revoke all on function public._gen_referral_code() from public, anon, authenticated;
revoke all on function public.my_referral_code() from public, anon;
revoke all on function public.redeem_referral_code(text) from public, anon;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.redeem_referral_code(text) to authenticated;

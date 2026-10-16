-- ================================================================
-- Consent withdrawal, practice-text retention, real account deletion (2026-09-26).
--
-- 1. WITHDRAWAL: when a user records practice_content_review = false, all of their
--    already-shared practice chat TEXT is deleted, in the same transaction as the
--    consent record (a trigger — so it cannot be skipped by a failed client call).
--    Session METADATA (practice_sessions) is not consent-gated content and stays.
-- 2. RETENTION: practice_messages older than 90 days are purged daily (same policy and
--    same mechanism as generated_replies). Needs pg_cron, like the earlier migration.
-- 3. ACCOUNT DELETION: delete_my_account() really deletes the account. The app used to
--    delete only the profiles row and sign out — the sign-in identity (auth.users) and
--    everything in every other table stayed behind, and the ON DELETE CASCADEs never
--    fired because the auth user was never removed.
--
-- Audit of what an account holds (and what this removes):
--   profiles                       -> deleted (keyed by id)
--   every public table with a user_id column -> deleted by the loop below: generated_replies,
--       onboarding_responses, practice_sessions, practice_messages, reports, api_rate_limits
--       (no FK, was orphaned before) and ALSO the pre-existing live tables scans, threads,
--       matches, messages if they have a user_id column (their schema was never in this repo)
--   referrals                      -> rows where they were the referrer deleted; rows where they
--                                     were the referred user keep the referrer's record, link cleared
--   auth.users                     -> deleted last (this is the actual sign-in identity)
--   KEPT ON PURPOSE: consent_records (compliance proof, no FK) and account_deletions (proof the
--       deletion happened; this function writes the row). Both hold only the user id, no content.
--       Confirm with counsel whether they should be anonymised instead.
-- ================================================================

-- ---- 1. withdrawal -> delete shared practice text ----------------
create or replace function public.purge_practice_text_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consent_type = 'practice_content_review' and new.granted = false then
    delete from public.practice_messages where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.purge_practice_text_on_withdrawal() from public, anon, authenticated;

drop trigger if exists consent_withdrawal_purges_practice_text on public.consent_records;
create trigger consent_withdrawal_purges_practice_text
  after insert on public.consent_records
  for each row execute function public.purge_practice_text_on_withdrawal();

-- ---- 2. 90-day retention for practice_messages -------------------
create index if not exists practice_messages_created_idx on public.practice_messages (created_at);

create or replace function public.purge_old_practice_messages(
  retention interval default interval '90 days'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  delete from public.practice_messages where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_practice_messages(interval) from public, anon, authenticated;
grant execute on function public.purge_old_practice_messages(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-practice-messages';
    perform cron.schedule('purge-practice-messages', '27 3 * * *',
                          'select public.purge_old_practice_messages()');
  else
    raise notice 'pg_cron is not available: purge_old_practice_messages() was created but is NOT scheduled.';
  end if;
end;
$$;

-- ---- 3. real account deletion ------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid       uuid := auth.uid();
  remaining text[];
  next_pass text[];
  tbl       text;
  pass      int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- proof the deletion happened (kept; holds only the id and timestamps)
  insert into public.account_deletions (user_id, requested_at, completed_at) values (uid, now(), now());

  -- every base table in public that has a user_id column, except the two kept-on-purpose ones
  select coalesce(array_agg(c.table_name::text), '{}') into remaining
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.column_name = 'user_id'
     and c.table_name not in ('consent_records', 'account_deletions');

  -- Tables can reference each other (some pre-existing tables' foreign keys are not in this repo),
  -- so retry the ones blocked by a foreign key on the next pass instead of failing the whole deletion.
  while coalesce(array_length(remaining, 1), 0) > 0 loop
    pass := pass + 1;
    if pass > 6 then
      raise exception 'account deletion blocked by foreign keys on: %', remaining;
    end if;
    next_pass := '{}';
    foreach tbl in array remaining loop
      begin
        execute format('delete from public.%I where user_id = $1', tbl) using uid;
      exception when foreign_key_violation then
        next_pass := next_pass || tbl;
      end;
    end loop;
    remaining := next_pass;
  end loop;

  delete from public.referrals where referrer_user_id = uid;
  update public.referrals set referred_user_id = null where referred_user_id = uid;
  delete from public.profiles where id = uid;

  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

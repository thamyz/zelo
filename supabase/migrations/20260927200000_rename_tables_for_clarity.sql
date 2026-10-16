-- ================================================================
-- Rename tables for clarity (2026-09-27) — no data is touched, only names.
--
-- Renamed (tables this project built):
--   generated_replies  -> scan_replies       (Scan's AI-generated reply text, tone, and the
--                                              👍/👎 "did it help" outcome)
--   matches            -> practice_sessions  (one row per Practice chat: metadata only)
--   messages           -> practice_messages  (Practice chat TEXT — only for users who opted in
--                                              to "Help Zelo get smarter")
--   ai_requests        -> ai_usage_log       (AI cost/reliability log — model, tokens, timing,
--                                              pass/fail; never a prompt or a reply)
--   reports            -> content_reports    ("report a reply/persona" — not analytics reports)
--   matches_legacy     -> legacy_unused_matches   (renamed again for clarity, still untouched)
--   messages_legacy    -> legacy_unused_messages  (renamed again for clarity, still untouched)
--
-- Also renamed, for the same reason (the user was confused seeing an empty "scans" table and
-- assuming it held Scan's data — it doesn't; scan_replies above is where that data actually is):
--   scans   -> legacy_unused_scans
--   threads -> legacy_unused_threads
-- These two predate this project's own migrations (present before anything here was written,
-- schema unknown) and this app has never written to them. A rename does not touch data or
-- foreign keys, so it is safe either way — flagged here only because, unlike every other table
-- in this file, these two were not created by this project, so there is no way to be certain
-- nothing else references them by name.
--
-- Left as-is (already clear): profiles, onboarding_responses, consent_records, referrals,
-- account_deletions, api_rate_limits.
--
-- Idempotent: every rename only fires if the OLD name still exists, so this can be re-run safely
-- even if it partly ran before.
-- ================================================================

do $$
begin
  if to_regclass('public.generated_replies') is not null then alter table public.generated_replies rename to scan_replies; end if;
  if to_regclass('public.matches')           is not null then alter table public.matches           rename to practice_sessions; end if;
  if to_regclass('public.messages')          is not null then alter table public.messages          rename to practice_messages; end if;
  if to_regclass('public.ai_requests')       is not null then alter table public.ai_requests        rename to ai_usage_log; end if;
  if to_regclass('public.reports')           is not null then alter table public.reports            rename to content_reports; end if;
  if to_regclass('public.matches_legacy')    is not null then alter table public.matches_legacy      rename to legacy_unused_matches; end if;
  if to_regclass('public.messages_legacy')   is not null then alter table public.messages_legacy     rename to legacy_unused_messages; end if;
  if to_regclass('public.scans')             is not null then alter table public.scans               rename to legacy_unused_scans; end if;
  if to_regclass('public.threads')           is not null then alter table public.threads             rename to legacy_unused_threads; end if;
end;
$$;

-- ---- Functions that named the old tables directly ----------------
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

create or replace function public.purge_old_practice_messages(retention interval default interval '90 days')
returns bigint
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

create or replace function public.purge_old_generated_replies(retention interval default interval '90 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  delete from public.scan_replies where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_generated_replies(interval) from public, anon, authenticated;
grant execute on function public.purge_old_generated_replies(interval) to service_role;

-- Re-point the pg_cron schedules at the renamed jobs (unschedule the old job names first so
-- there is never a duplicate; the functions above already point at the new table names).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname in ('purge-generated-replies', 'purge-scan-replies');
    perform cron.schedule('purge-scan-replies', '17 3 * * *', 'select public.purge_old_generated_replies()');
    perform cron.unschedule(jobid) from cron.job where jobname in ('purge-practice-messages');
    perform cron.schedule('purge-practice-messages', '27 3 * * *', 'select public.purge_old_practice_messages()');
  end if;
end;
$$;

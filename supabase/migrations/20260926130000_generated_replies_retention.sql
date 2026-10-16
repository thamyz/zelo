-- ================================================================
-- generated_replies retention: delete rows older than 90 days (2026-09-26).
--
-- 90 days was the product decision: these are Zelo's own outputs (not the
-- user's private conversation), and a 90-day window is long enough to spot
-- slow-moving tone-quality trends. To change it, change the interval default
-- below (or re-run this file with a new value).
--
-- Runs daily at 03:17 UTC via pg_cron. If pg_cron isn't available on the
-- project (Dashboard > Database > Extensions), the function is still created
-- and a NOTICE is raised — call `select public.purge_old_generated_replies();`
-- from any other scheduler, or enable pg_cron and re-run this migration.
-- ================================================================

create index if not exists generated_replies_created_idx
  on public.generated_replies (created_at);

create or replace function public.purge_old_generated_replies(
  retention interval default interval '90 days'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  delete from public.generated_replies where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Not callable by any client role — only the scheduler / service_role.
revoke all on function public.purge_old_generated_replies(interval) from public;
revoke all on function public.purge_old_generated_replies(interval) from anon;
revoke all on function public.purge_old_generated_replies(interval) from authenticated;
grant execute on function public.purge_old_generated_replies(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-generated-replies';
    perform cron.schedule('purge-generated-replies', '17 3 * * *',
                          'select public.purge_old_generated_replies()');
  else
    raise notice 'pg_cron is not available: purge_old_generated_replies() was created but is NOT scheduled.';
  end if;
end;
$$;

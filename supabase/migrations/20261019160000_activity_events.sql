-- activity_events: one tiny row per thing the user did that the Home "Your Activity" widget counts
-- (a scan that produced replies, a reply generated, a practice profile liked). Lets the counts survive a
-- reinstall or a new phone and gives product-level usage numbers. NO message text, no profile ids:
-- only { who, what kind, when }.
--
-- The id is generated on the phone, so a retried upload after a lost response cannot double-count
-- (the client upserts with ignoreDuplicates). created_at is supplied by the client so an event made
-- offline keeps its real time; that makes it unsuitable for anything competitive (leaderboard) without
-- server-side validation first, which is fine for a user's own widget.
--
-- GRANTs are in this same file on purpose: new tables on this project are not auto-granted to the API
-- roles and Postgres checks GRANTs before RLS (see 20260926140000_grant_table_privileges.sql).
--
-- Run in the ZELO project's SQL editor (bfxxywxhydxvccusjinm); the local CLI is on another account.

create table if not exists public.activity_events (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('scan', 'reply', 'like', 'chat')),
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_time_idx
  on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists activity_events_select_own on public.activity_events;
create policy activity_events_select_own on public.activity_events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists activity_events_insert_own on public.activity_events;
create policy activity_events_insert_own on public.activity_events
  for insert to authenticated with check (user_id = auth.uid());

-- No update/delete policy on purpose: events are append-only for the client. Account deletion removes
-- them through the user_id cascade (and delete_my_account()'s user_id sweep).
revoke all on public.activity_events from anon;
grant select, insert on public.activity_events to authenticated;
grant all on public.activity_events to service_role;

-- Retention: the widget only looks back 7 days (the app keeps 30 locally), so 90 days is plenty.
create or replace function public.purge_old_activity_events(retention interval default interval '90 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  delete from public.activity_events where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_old_activity_events(interval) from public, anon, authenticated;
grant execute on function public.purge_old_activity_events(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-activity-events';
    perform cron.schedule('purge-activity-events', '47 3 * * *', 'select public.purge_old_activity_events()');
  else
    raise notice 'pg_cron is not available: purge_old_activity_events() was created but is NOT scheduled.';
  end if;
end;
$$;

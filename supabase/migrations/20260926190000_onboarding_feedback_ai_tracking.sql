-- ================================================================
-- Data collection round 2 (2026-09-26): onboarding answers, reply feedback, AI request log.
-- One paste. Idempotent. Needs 20260926120000 / 140000 (tables + grants) to have been run.
-- ================================================================

-- ---- 1. onboarding answers: one row per (user, question) so re-answering updates instead of piling up
create unique index if not exists onboarding_responses_user_key_uidx
  on public.onboarding_responses (user_id, question_key);

-- ---- 2. reply feedback ("how did your reply land?"): 👍/👎 recorded on the reply's own row
alter table public.generated_replies
  add column if not exists outcome    text check (outcome in ('helped', 'not_helped')),
  add column if not exists outcome_at timestamptz;

-- ---- 3. AI request log: cost + reliability, NEVER content (no prompt, no reply, no text of any kind)
create table if not exists public.ai_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null,                    -- scan_reply | chat_reply | coach | ocr
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  latency_ms        int,
  ok                boolean not null,
  error_kind        text,                             -- auth | limit | net | server (null when ok)
  created_at        timestamptz not null default now()
);
create index if not exists ai_requests_user_idx    on public.ai_requests (user_id, created_at desc);
create index if not exists ai_requests_created_idx on public.ai_requests (created_at);

alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon;
grant select, insert on public.ai_requests to authenticated;   -- append-only for clients
grant all on public.ai_requests to service_role;

drop policy if exists "ai_requests_select_own" on public.ai_requests;
drop policy if exists "ai_requests_insert_own" on public.ai_requests;
create policy "ai_requests_select_own" on public.ai_requests for select to authenticated using (auth.uid() = user_id);
create policy "ai_requests_insert_own" on public.ai_requests for insert to authenticated with check (auth.uid() = user_id);

-- same 90-day retention as the other logs
create or replace function public.purge_old_ai_requests(retention interval default interval '90 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  delete from public.ai_requests where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_ai_requests(interval) from public, anon, authenticated;
grant execute on function public.purge_old_ai_requests(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-ai-requests';
    perform cron.schedule('purge-ai-requests', '37 3 * * *', 'select public.purge_old_ai_requests()');
  else
    raise notice 'pg_cron is not available: purge_old_ai_requests() was created but is NOT scheduled.';
  end if;
end;
$$;
-- (delete_my_account() already removes ai_requests: it loops over every public table with a user_id column.)

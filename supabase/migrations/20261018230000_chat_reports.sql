-- Reports about the AI, sent from the practice chat ("Report" on a held reply, or
-- "Report a Problem" in the chat settings). The user sees a sheet that says the whole
-- conversation is sent; nothing is sent until they tap Send report.
--
-- Builds on content_reports (created as `reports` in 20260926120000, renamed in
-- 20260927200000), which already has owner-only RLS and select+insert grants. This only
-- adds the columns a report about a conversation needs. NOT APPLIED until pasted into the
-- Zelo project's SQL editor. Until it is, the app keeps reports queued on the phone
-- (zelo_pending_reports) and retries on sign-in/launch, so nothing is lost.

do $$
begin
  if to_regclass('public.content_reports') is null and to_regclass('public.reports') is not null then
    alter table public.reports rename to content_reports;
  end if;
end $$;

alter table public.content_reports
  add column if not exists persona_id   text,
  add column if not exists message_id   text,
  add column if not exists message_text text,
  add column if not exists note         text,
  add column if not exists conversation jsonb,
  add column if not exists app_build    text;

-- A report is the user's own record: they may insert and read their own, never edit or delete.
alter table public.content_reports enable row level security;
grant select, insert on public.content_reports to authenticated;
grant all on public.content_reports to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_reports' and cmd = 'INSERT') then
    create policy content_reports_insert_own on public.content_reports for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_reports' and cmd = 'SELECT') then
    create policy content_reports_select_own on public.content_reports for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Retention: the conversation inside a report is chat text, so it is not kept forever.
-- 180 days after the report, the conversation and message text are cleared (the reason,
-- note and ids stay for counting). pg_cron schedules it daily if the extension exists.
create or replace function public.purge_old_report_conversations()
returns void language sql security definer set search_path = public as $$
  update public.content_reports
     set conversation = null, message_text = null
   where created_at < now() - interval '180 days'
     and (conversation is not null or message_text is not null);
$$;
revoke all on function public.purge_old_report_conversations() from public, anon, authenticated;
grant execute on function public.purge_old_report_conversations() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge_old_report_conversations';
    perform cron.schedule('purge_old_report_conversations', '47 3 * * *', 'select public.purge_old_report_conversations()');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

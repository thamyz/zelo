-- ================================================================
-- Give the practice tables the names people actually look for (2026-09-26).
--
-- Why: the dashboard already had two OLDER tables called `matches` and `messages` that the app has
-- never written to (chats live on the phone), so they always looked empty while the new data went to
-- `practice_sessions` / `practice_messages`. Now:
--   old  matches  -> matches_legacy   (data kept, nothing deleted)
--   old  messages -> messages_legacy
--   practice_sessions  -> matches     (one row per practice chat, metadata only)
--   practice_messages  -> messages    (chat text, only for users who opted in)
-- RLS, policies, grants, indexes and foreign keys follow a rename automatically; the two functions that
-- name the messages table are re-created below. Idempotent.
--
-- Needs 20260926150000 and 20260926160000 to have been run first (they create the tables and functions).
-- ================================================================

do $$
begin
  -- Safety: never re-point the withdrawal/retention functions at an OLD messages table.
  if to_regclass('public.practice_messages') is null then
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'messages' and column_name = 'session_id') then
      raise exception 'Run 20260926150000_practice_sessions_and_messages.sql first (public.practice_messages not found).';
    end if;
  end if;

  -- 1. park the legacy tables (only if the new ones still have their old names, i.e. not yet renamed)
  if to_regclass('public.practice_sessions') is not null and to_regclass('public.matches') is not null then
    alter table public.matches rename to matches_legacy;
  end if;
  if to_regclass('public.practice_messages') is not null and to_regclass('public.messages') is not null then
    alter table public.messages rename to messages_legacy;
  end if;

  -- 2. the new tables take the names
  if to_regclass('public.practice_sessions') is not null then
    alter table public.practice_sessions rename to matches;
  end if;
  if to_regclass('public.practice_messages') is not null then
    alter table public.practice_messages rename to messages;
  end if;
end;
$$;

-- functions that referred to practice_messages by name
create or replace function public.purge_practice_text_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consent_type = 'practice_content_review' and new.granted = false then
    delete from public.messages where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.purge_practice_text_on_withdrawal() from public, anon, authenticated;

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
  delete from public.messages where created_at < now() - retention;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_practice_messages(interval) from public, anon, authenticated;
grant execute on function public.purge_old_practice_messages(interval) to service_role;

-- ================================================================
-- Practice chat storage (2026-09-26): "Help Zelo get smarter".
--
-- practice_sessions  — METADATA about every practice chat, always saved:
--                      persona, difficulty, mode, start/end, how many messages the
--                      user sent, finished/abandoned. No text.
-- practice_messages  — the chat TEXT. Saved only for users who opted in
--                      (consent_type 'practice_content_review'). The rule is enforced
--                      HERE, not just in the app: an insert is rejected unless the
--                      user's most recent practice_content_review consent record says
--                      granted = true. Scan input and real conversations never go here.
--
-- New tables on this project are NOT auto-granted to the API roles, so the GRANTs
-- below are part of this migration (see 20260926140000 for why).
--
-- OPEN DECISIONS (nothing here assumes an answer):
--  * Turning the setting off stops future text saving but does NOT delete text that
--    was already saved.
--  * No automatic retention/purge exists for practice_messages yet.
--  * The app's deleteAccount() only removes the profiles row; ON DELETE CASCADE on
--    auth.users only fires when the auth user itself is deleted.
-- ================================================================

create table if not exists public.practice_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  persona_id    text not null,
  difficulty    text,
  mode          text,
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  message_count int not null default 0,
  outcome       text not null check (outcome in ('finished', 'abandoned')),
  created_at    timestamptz not null default now()
);
create index if not exists practice_sessions_user_idx on public.practice_sessions (user_id, started_at desc);

create table if not exists public.practice_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  sender     text not null check (sender in ('user', 'persona')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists practice_messages_session_idx on public.practice_messages (session_id, created_at);
create index if not exists practice_messages_user_idx on public.practice_messages (user_id);

alter table public.practice_sessions enable row level security;
alter table public.practice_messages enable row level security;

revoke all on public.practice_sessions, public.practice_messages from anon;
grant select, insert, delete on public.practice_sessions to authenticated;   -- no update: a session is written once
grant select, insert, delete on public.practice_messages to authenticated;
grant all on public.practice_sessions, public.practice_messages to service_role;

drop policy if exists "practice_sessions_select_own" on public.practice_sessions;
drop policy if exists "practice_sessions_insert_own" on public.practice_sessions;
drop policy if exists "practice_sessions_delete_own" on public.practice_sessions;
create policy "practice_sessions_select_own" on public.practice_sessions for select to authenticated using (auth.uid() = user_id);
create policy "practice_sessions_insert_own" on public.practice_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "practice_sessions_delete_own" on public.practice_sessions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "practice_messages_select_own" on public.practice_messages;
drop policy if exists "practice_messages_insert_with_consent" on public.practice_messages;
drop policy if exists "practice_messages_delete_own" on public.practice_messages;
create policy "practice_messages_select_own" on public.practice_messages for select to authenticated using (auth.uid() = user_id);
create policy "practice_messages_delete_own" on public.practice_messages for delete to authenticated using (auth.uid() = user_id);
create policy "practice_messages_insert_with_consent" on public.practice_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((
      select c.granted
        from public.consent_records c
       where c.user_id = auth.uid()
         and c.consent_type = 'practice_content_review'
       order by c."timestamp" desc, c.id desc
       limit 1
    ), false)
  );

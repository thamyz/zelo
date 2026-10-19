-- In-app support messages (Report a problem / Contact support) and the Feature Requests board.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm). Idempotent.
--
-- support_messages : one row per message, with a small diagnostics text block (build, device,
--                    recent error NAMES; never chats). Owner can insert/select their own only.
-- feature_requests : users' requests. Everyone signed in can read live ones, but ONLY through
--                    list_feature_requests() — the table itself is owner-only, so other people's
--                    user ids are never exposed. A trigger checks every request before it goes live.
-- feature_votes    : one vote per user per request, changed only through toggle_feature_vote().

-- ───────────────────────── support_messages ─────────────────────────
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('problem', 'contact')),
  message      text not null check (char_length(message) between 1 and 4000),
  diagnostics  text,
  app_build    text,
  created_at   timestamptz not null default now()
);
alter table public.support_messages enable row level security;
drop policy if exists support_messages_insert_own on public.support_messages;
drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_insert_own on public.support_messages for insert to authenticated with check (user_id = auth.uid());
create policy support_messages_select_own on public.support_messages for select to authenticated using (user_id = auth.uid());
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
revoke all on public.support_messages from anon;

-- At most 10 messages per user per day (stops a runaway loop or spam).
create or replace function public.support_messages_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.support_messages where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'zelo:daily_limit';
  end if;
  return new;
end $$;
drop trigger if exists support_messages_limit_trg on public.support_messages;
create trigger support_messages_limit_trg before insert on public.support_messages
  for each row execute function public.support_messages_limit();

-- ───────────────────────── feature_requests / votes ─────────────────────────
create table if not exists public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 8 and 120),
  body        text not null default '' check (char_length(body) <= 2000),
  author_tag  text not null default '',
  status      text not null default 'live' check (status in ('live', 'held')),
  vote_count  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists feature_requests_status_votes_idx on public.feature_requests (status, vote_count desc, created_at desc);

create table if not exists public.feature_votes (
  request_id  uuid not null references public.feature_requests(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table public.feature_requests enable row level security;
alter table public.feature_votes    enable row level security;
drop policy if exists feature_requests_insert_own on public.feature_requests;
drop policy if exists feature_requests_select_own on public.feature_requests;
create policy feature_requests_insert_own on public.feature_requests for insert to authenticated with check (user_id = auth.uid());
create policy feature_requests_select_own on public.feature_requests for select to authenticated using (user_id = auth.uid());
-- Only title and body are writable by the client; everything else is set by the trigger below.
revoke all on public.feature_requests from anon, authenticated;
grant select on public.feature_requests to authenticated;
grant insert (title, body) on public.feature_requests to authenticated;
grant all on public.feature_requests to service_role;
-- feature_votes: no policies and no grants for clients — only the functions below touch it.
revoke all on public.feature_votes from anon, authenticated;
grant all on public.feature_votes to service_role;

-- Checks every new request, automatically:
--   * same title (ignoring case) as an existing live request  -> rejected ('zelo:duplicate')
--   * more than 3 requests in 24 hours                         -> rejected ('zelo:daily_limit')
--   * links, e-mail addresses, phone-like numbers or rude words -> saved but 'held' (not shown to others)
create or replace function public.feature_requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.body  := btrim(coalesce(new.body, ''));
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  new.vote_count := 0;
  new.status := 'live';
  if exists (select 1 from public.feature_requests r where r.status = 'live' and lower(r.title) = lower(new.title)) then
    raise exception 'zelo:duplicate';
  end if;
  if (select count(*) from public.feature_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'zelo:daily_limit';
  end if;
  t := lower(new.title || ' ' || new.body);
  if t ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|ly|me|xyz)\y|@[a-z0-9_.]{3,}|[0-9][0-9 ()+.-]{8,}[0-9])'
     or t ~ '\y(fuck|fucking|shit|bitch|cunt|nigger|nigga|faggot|retard|whore|slut|rape|kys)\y'
  then
    new.status := 'held';
  end if;
  return new;
end $$;
drop trigger if exists feature_requests_before_insert_trg on public.feature_requests;
create trigger feature_requests_before_insert_trg before insert on public.feature_requests
  for each row execute function public.feature_requests_before_insert();

-- The author's own vote counts, like on any board.
create or replace function public.feature_requests_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.feature_votes (request_id, user_id) values (new.id, new.user_id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists feature_requests_after_insert_trg on public.feature_requests;
create trigger feature_requests_after_insert_trg after insert on public.feature_requests
  for each row execute function public.feature_requests_after_insert();

-- One mechanism keeps vote_count right: insert/delete on feature_votes.
create or replace function public.feature_votes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.feature_requests set vote_count = vote_count + 1 where id = new.request_id;
    return new;
  else
    update public.feature_requests set vote_count = greatest(0, vote_count - 1) where id = old.request_id;
    return old;
  end if;
end $$;
drop trigger if exists feature_votes_count_trg on public.feature_votes;
create trigger feature_votes_count_trg after insert or delete on public.feature_votes
  for each row execute function public.feature_votes_count();

-- The board. Live requests from everyone + the caller's own (including held ones, flagged by status).
create or replace function public.list_feature_requests(p_sort text default 'top', p_query text default '', p_limit int default 50)
returns table (id uuid, title text, body text, author_tag text, status text, vote_count int, created_at timestamptz, i_voted boolean, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.body, r.author_tag, r.status, r.vote_count, r.created_at,
         exists (select 1 from public.feature_votes v where v.request_id = r.id and v.user_id = auth.uid()),
         r.user_id = auth.uid()
  from public.feature_requests r
  where auth.uid() is not null
    and (r.status = 'live' or r.user_id = auth.uid())
    and (coalesce(p_query, '') = ''
         or position(lower(p_query) in lower(r.title)) > 0
         or position(lower(p_query) in lower(r.body)) > 0)
  order by case when p_sort = 'new' then extract(epoch from r.created_at) else r.vote_count end desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- Vote / un-vote. Returns the new state and count.
create or replace function public.toggle_feature_vote(p_request uuid)
returns table (voted boolean, vote_count int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and (r.status = 'live' or r.user_id = uid)) then
    raise exception 'zelo:not_found';
  end if;
  if exists (select 1 from public.feature_votes v where v.request_id = p_request and v.user_id = uid) then
    delete from public.feature_votes v where v.request_id = p_request and v.user_id = uid;
    return query select false, (select r.vote_count from public.feature_requests r where r.id = p_request);
  else
    insert into public.feature_votes (request_id, user_id) values (p_request, uid);
    return query select true, (select r.vote_count from public.feature_requests r where r.id = p_request);
  end if;
end $$;

revoke all on function public.list_feature_requests(text, text, int) from public, anon;
revoke all on function public.toggle_feature_vote(uuid) from public, anon;
grant execute on function public.list_feature_requests(text, text, int) to authenticated;
grant execute on function public.toggle_feature_vote(uuid) to authenticated;

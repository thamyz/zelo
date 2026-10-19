-- Feature Requests, part 2: comments, and editing / deleting your own post.
-- Run AFTER 20261019100000_support_and_feature_requests.sql. Idempotent.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm).
--
-- feature_comments : comments on a request. Clients never touch the table; everything goes
--                    through the functions below (so other people's user ids are never exposed).
-- Rules, all automatic: links / e-mails / phone numbers / rude words -> the comment (or the edited
-- post) is saved as 'held' and only its author sees it; 30 comments per user per day.

-- One place for the "is this text OK to show others?" check, used by posts, edits and comments.
create or replace function public.feature_text_status(p_text text) returns text
language sql immutable set search_path = public as $$
  select case
    when lower(coalesce(p_text, '')) ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|ly|me|xyz)\y|@[a-z0-9_.]{3,}|[0-9][0-9 ()+.-]{8,}[0-9])' then 'held'
    when lower(coalesce(p_text, '')) ~ '\y(fuck|fucking|shit|bitch|cunt|nigger|nigga|faggot|retard|whore|slut|rape|kys)\y' then 'held'
    else 'live'
  end
$$;

-- Requests now use the shared check (behaviour unchanged).
create or replace function public.feature_requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.body  := btrim(coalesce(new.body, ''));
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  new.vote_count := 0;
  if exists (select 1 from public.feature_requests r where r.status = 'live' and lower(r.title) = lower(new.title)) then
    raise exception 'zelo:duplicate';
  end if;
  if (select count(*) from public.feature_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := public.feature_text_status(new.title || ' ' || new.body);
  return new;
end $$;

alter table public.feature_requests add column if not exists comment_count int not null default 0;
alter table public.feature_requests add column if not exists edited_at timestamptz;

create table if not exists public.feature_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.feature_requests(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  author_tag  text not null default '',
  status      text not null default 'live' check (status in ('live', 'held')),
  created_at  timestamptz not null default now()
);
create index if not exists feature_comments_request_idx on public.feature_comments (request_id, created_at);
alter table public.feature_comments enable row level security;
revoke all on public.feature_comments from anon, authenticated;
grant all on public.feature_comments to service_role;

create or replace function public.feature_comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.body := btrim(new.body);
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  if (select count(*) from public.feature_comments c where c.user_id = new.user_id and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := public.feature_text_status(new.body);
  return new;
end $$;
drop trigger if exists feature_comments_before_insert_trg on public.feature_comments;
create trigger feature_comments_before_insert_trg before insert on public.feature_comments
  for each row execute function public.feature_comments_before_insert();

-- comment_count = number of LIVE comments, kept right on insert and delete.
create or replace function public.feature_comments_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := coalesce(new.request_id, old.request_id);
begin
  update public.feature_requests r set comment_count = (select count(*) from public.feature_comments c where c.request_id = rid and c.status = 'live') where r.id = rid;
  return null;
end $$;
drop trigger if exists feature_comments_count_trg on public.feature_comments;
create trigger feature_comments_count_trg after insert or delete on public.feature_comments
  for each row execute function public.feature_comments_count();

-- ───────────── reading ─────────────
-- The board gains comment_count (the return type changes, so the old function is replaced).
drop function if exists public.list_feature_requests(text, text, int);
create function public.list_feature_requests(p_sort text default 'top', p_query text default '', p_limit int default 50)
returns table (id uuid, title text, body text, author_tag text, status text, vote_count int, comment_count int, created_at timestamptz, edited_at timestamptz, i_voted boolean, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.body, r.author_tag, r.status, r.vote_count, r.comment_count, r.created_at, r.edited_at,
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

-- One request (for its own page). Same columns as the board.
create or replace function public.get_feature_request(p_request uuid)
returns table (id uuid, title text, body text, author_tag text, status text, vote_count int, comment_count int, created_at timestamptz, edited_at timestamptz, i_voted boolean, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.body, r.author_tag, r.status, r.vote_count, r.comment_count, r.created_at, r.edited_at,
         exists (select 1 from public.feature_votes v where v.request_id = r.id and v.user_id = auth.uid()),
         r.user_id = auth.uid()
  from public.feature_requests r
  where auth.uid() is not null and r.id = p_request and (r.status = 'live' or r.user_id = auth.uid())
$$;

-- Comments on a request: live ones from everyone plus your own held ones, oldest first.
create or replace function public.list_feature_comments(p_request uuid)
returns table (id uuid, body text, author_tag text, status text, created_at timestamptz, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.author_tag, c.status, c.created_at, c.user_id = auth.uid()
  from public.feature_comments c
  join public.feature_requests r on r.id = c.request_id
  where auth.uid() is not null
    and c.request_id = p_request
    and (r.status = 'live' or r.user_id = auth.uid())
    and (c.status = 'live' or c.user_id = auth.uid())
  order by c.created_at asc
  limit 200
$$;

-- ───────────── writing ─────────────
create or replace function public.add_feature_comment(p_request uuid, p_body text)
returns table (id uuid, body text, author_tag text, status text, created_at timestamptz, is_mine boolean)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'zelo:invalid'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and (r.status = 'live' or r.user_id = uid)) then
    raise exception 'zelo:not_found';
  end if;
  insert into public.feature_comments (request_id, user_id, body) values (p_request, uid, p_body) returning feature_comments.id into new_id;
  return query select c.id, c.body, c.author_tag, c.status, c.created_at, true from public.feature_comments c where c.id = new_id;
end $$;

create or replace function public.delete_feature_comment(p_comment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'zelo:signed_out'; end if;
  delete from public.feature_comments c where c.id = p_comment and c.user_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Edit your own request. Same rules as a new one: re-checked, may go 'held'.
create or replace function public.update_feature_request(p_request uuid, p_title text, p_body text)
returns table (id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text; b text; st text;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  t := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  b := btrim(coalesce(p_body, ''));
  if char_length(t) not between 8 and 120 or char_length(b) > 2000 then raise exception 'zelo:invalid'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and r.user_id = uid) then raise exception 'zelo:not_found'; end if;
  if exists (select 1 from public.feature_requests r where r.id <> p_request and r.status = 'live' and lower(r.title) = lower(t)) then raise exception 'zelo:duplicate'; end if;
  st := public.feature_text_status(t || ' ' || b);
  update public.feature_requests r set title = t, body = b, status = st, edited_at = now() where r.id = p_request and r.user_id = uid;
  return query select p_request, st;
end $$;

-- Delete your own request (its votes and comments go with it).
create or replace function public.delete_feature_request(p_request uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'zelo:signed_out'; end if;
  delete from public.feature_requests r where r.id = p_request and r.user_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.feature_text_status(text) from public, anon, authenticated;
revoke all on function public.list_feature_requests(text, text, int) from public, anon;
revoke all on function public.get_feature_request(uuid) from public, anon;
revoke all on function public.list_feature_comments(uuid) from public, anon;
revoke all on function public.add_feature_comment(uuid, text) from public, anon;
revoke all on function public.delete_feature_comment(uuid) from public, anon;
revoke all on function public.update_feature_request(uuid, text, text) from public, anon;
revoke all on function public.delete_feature_request(uuid) from public, anon;
grant execute on function public.list_feature_requests(text, text, int) to authenticated;
grant execute on function public.get_feature_request(uuid) to authenticated;
grant execute on function public.list_feature_comments(uuid) to authenticated;
grant execute on function public.add_feature_comment(uuid, text) to authenticated;
grant execute on function public.delete_feature_comment(uuid) to authenticated;
grant execute on function public.update_feature_request(uuid, text, text) to authenticated;
grant execute on function public.delete_feature_request(uuid) to authenticated;

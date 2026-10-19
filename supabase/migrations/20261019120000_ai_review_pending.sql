-- Feature Requests, part 3: AI review. Run AFTER 20261019100000 and 20261019110000. Idempotent.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm).
--
-- New flow for posts, comments and edits:
--   1. The free rule check runs first: bad words are refused outright; links / e-mail / phone numbers are held.
--   2. Anything that passes is saved as 'pending'. Only its author sees it, marked "Checking".
--   3. The app asks the edge function `moderate-feature-text` (Gemini) to review it, which sets it to
--      'live' or 'held'.
--   4. If the review never happens (function not deployed yet, Gemini down, user closed the app),
--      a 'pending' item becomes visible to everyone after 3 minutes, so nothing is stuck. The free
--      rule check already passed for it.

alter table public.feature_requests add column if not exists pending_since   timestamptz not null default now();
alter table public.feature_requests add column if not exists moderation_tries int         not null default 0;
alter table public.feature_comments add column if not exists pending_since   timestamptz not null default now();
alter table public.feature_comments add column if not exists moderation_tries int         not null default 0;

alter table public.feature_requests drop constraint if exists feature_requests_status_check;
alter table public.feature_requests add  constraint feature_requests_status_check check (status in ('live', 'held', 'pending'));
alter table public.feature_comments drop constraint if exists feature_comments_status_check;
alter table public.feature_comments add  constraint feature_comments_status_check check (status in ('live', 'held', 'pending'));

-- Who may see an item: everyone once it is live (or has waited 3 minutes unreviewed), and always its author.
create or replace function public.feature_visible(p_status text, p_pending_since timestamptz, p_owner uuid) returns boolean
language sql stable set search_path = public as $$
  select p_status = 'live'
      or (p_status = 'pending' and p_pending_since < now() - interval '3 minutes')
      or p_owner = auth.uid()
$$;

-- Bad words are not allowed at all: the post is REFUSED ('zelo:inappropriate'), also when written with look-alike
-- characters (f*ck, sh1t, fuuuck). Mirrors services/textguard.js, which stops it earlier in the app.
create or replace function public.feature_text_rude(p_text text) returns boolean
language sql immutable set search_path = public as $$
  select regexp_replace(translate(lower(coalesce(p_text, '')), '013457@$!|', 'oieastasii'), '(.)\1{2,}', '\1\1', 'g')
    ~ '\y(f+u+c+k+(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?|f+u+k+(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?|sh+i+t+(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?|b+i+t+c+h+(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?|c+u+n+t+(s|es|ed|er|ers|ing|in|y|ies|head|heads|wit|wits|face|hole|holes|off)?|n+i+g+[ae]+r*s?|n+i+g+g+(a|er|ers|as)|f+a+g+(o+t+)?s?|r+e+t+a+r+d+(s|ed|ing)?|wh+o+r+e+s?|s+l+u+t+(s|ty)?|d+i+c+k+(s|head|heads)?|p+u+s+s+(y|ies)|a+s+s+h+o+l+e+s?|b+a+s+t+a+r+d+s?|k+y+s|kill +(yo)?u?r? *self|p+o+r+n+(o|s)?|n+a+z+i+s?|p+i+s+s+(ed|ing|es)?|t+w+a+t+s?|w+a+n+k+(er|ers|s)?|c+o+c+k+s?|r+a+p+(e|ed|es|ing|ist)|c+u+m+(shot)?)\y'
$$;

-- Links, e-mail addresses and phone numbers are held (not shown); everything else waits for the AI review.
create or replace function public.feature_text_status(p_text text) returns text
language sql immutable set search_path = public as $$
  select case
    when lower(coalesce(p_text, '')) ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|ly|me|xyz)\y|@[a-z0-9_.]{3,}|[0-9][0-9 ()+.-]{8,}[0-9])' then 'held'
    else 'pending'
  end
$$;

create or replace function public.feature_requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.body  := btrim(coalesce(new.body, ''));
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  new.vote_count := 0;
  if public.feature_text_rude(new.title || ' ' || new.body) then raise exception 'zelo:inappropriate'; end if;
  if exists (select 1 from public.feature_requests r where r.status in ('live', 'pending') and lower(r.title) = lower(new.title)) then
    raise exception 'zelo:duplicate';
  end if;
  if (select count(*) from public.feature_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := public.feature_text_status(new.title || ' ' || new.body);
  new.pending_since := now();
  new.moderation_tries := 0;
  return new;
end $$;

create or replace function public.feature_comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.body := btrim(new.body);
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  if public.feature_text_rude(new.body) then raise exception 'zelo:inappropriate'; end if;
  if (select count(*) from public.feature_comments c where c.user_id = new.user_id and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := public.feature_text_status(new.body);
  new.pending_since := now();
  new.moderation_tries := 0;
  return new;
end $$;

-- comment_count = LIVE comments; now also re-counted when the review flips a comment's status.
drop trigger if exists feature_comments_count_trg on public.feature_comments;
create trigger feature_comments_count_trg after insert or update of status or delete on public.feature_comments
  for each row execute function public.feature_comments_count();

-- ───────────── reading (same columns as before) ─────────────
create or replace function public.list_feature_requests(p_sort text default 'top', p_query text default '', p_limit int default 50)
returns table (id uuid, title text, body text, author_tag text, status text, vote_count int, comment_count int, created_at timestamptz, edited_at timestamptz, i_voted boolean, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.body, r.author_tag, r.status, r.vote_count, r.comment_count, r.created_at, r.edited_at,
         exists (select 1 from public.feature_votes v where v.request_id = r.id and v.user_id = auth.uid()),
         r.user_id = auth.uid()
  from public.feature_requests r
  where auth.uid() is not null
    and public.feature_visible(r.status, r.pending_since, r.user_id)
    and (coalesce(p_query, '') = ''
         or position(lower(p_query) in lower(r.title)) > 0
         or position(lower(p_query) in lower(r.body)) > 0)
  order by case when p_sort = 'new' then extract(epoch from r.created_at) else r.vote_count end desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

create or replace function public.get_feature_request(p_request uuid)
returns table (id uuid, title text, body text, author_tag text, status text, vote_count int, comment_count int, created_at timestamptz, edited_at timestamptz, i_voted boolean, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.body, r.author_tag, r.status, r.vote_count, r.comment_count, r.created_at, r.edited_at,
         exists (select 1 from public.feature_votes v where v.request_id = r.id and v.user_id = auth.uid()),
         r.user_id = auth.uid()
  from public.feature_requests r
  where auth.uid() is not null and r.id = p_request and public.feature_visible(r.status, r.pending_since, r.user_id)
$$;

create or replace function public.list_feature_comments(p_request uuid)
returns table (id uuid, body text, author_tag text, status text, created_at timestamptz, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.author_tag, c.status, c.created_at, c.user_id = auth.uid()
  from public.feature_comments c
  join public.feature_requests r on r.id = c.request_id
  where auth.uid() is not null
    and c.request_id = p_request
    and public.feature_visible(r.status, r.pending_since, r.user_id)
    and public.feature_visible(c.status, c.pending_since, c.user_id)
  order by c.created_at asc
  limit 200
$$;

-- ───────────── writing ─────────────
create or replace function public.toggle_feature_vote(p_request uuid)
returns table (voted boolean, vote_count int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and public.feature_visible(r.status, r.pending_since, r.user_id)) then
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

create or replace function public.add_feature_comment(p_request uuid, p_body text)
returns table (id uuid, body text, author_tag text, status text, created_at timestamptz, is_mine boolean)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'zelo:invalid'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and public.feature_visible(r.status, r.pending_since, r.user_id)) then
    raise exception 'zelo:not_found';
  end if;
  insert into public.feature_comments (request_id, user_id, body) values (p_request, uid, p_body) returning feature_comments.id into new_id;
  return query select c.id, c.body, c.author_tag, c.status, c.created_at, true from public.feature_comments c where c.id = new_id;
end $$;

-- Editing sends the post back through the check (rules first, then the AI review).
create or replace function public.update_feature_request(p_request uuid, p_title text, p_body text)
returns table (id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text; b text; st text;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  t := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  b := btrim(coalesce(p_body, ''));
  if char_length(t) not between 8 and 120 or char_length(b) > 2000 then raise exception 'zelo:invalid'; end if;
  if public.feature_text_rude(t || ' ' || b) then raise exception 'zelo:inappropriate'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and r.user_id = uid) then raise exception 'zelo:not_found'; end if;
  if exists (select 1 from public.feature_requests r where r.id <> p_request and r.status in ('live', 'pending') and lower(r.title) = lower(t)) then raise exception 'zelo:duplicate'; end if;
  st := public.feature_text_status(t || ' ' || b);
  update public.feature_requests r
     set title = t, body = b, status = st, edited_at = now(), pending_since = now(), moderation_tries = 0
   where r.id = p_request and r.user_id = uid;
  return query select p_request, st;
end $$;

revoke all on function public.list_feature_requests(text, text, int) from public, anon;
revoke all on function public.get_feature_request(uuid) from public, anon;
revoke all on function public.list_feature_comments(uuid) from public, anon;
revoke all on function public.toggle_feature_vote(uuid) from public, anon;
revoke all on function public.add_feature_comment(uuid, text) from public, anon;
revoke all on function public.update_feature_request(uuid, text, text) from public, anon;
grant execute on function public.list_feature_requests(text, text, int) to authenticated;
grant execute on function public.get_feature_request(uuid) to authenticated;
grant execute on function public.list_feature_comments(uuid) to authenticated;
grant execute on function public.toggle_feature_vote(uuid) to authenticated;
grant execute on function public.add_feature_comment(uuid, text) to authenticated;
grant execute on function public.update_feature_request(uuid, text, text) to authenticated;

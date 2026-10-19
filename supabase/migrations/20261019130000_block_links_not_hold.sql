-- Feature Requests, part 4. Run AFTER 20261019100000, 20261019110000 and 20261019120000. Idempotent.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm).
--
-- 1. A link / e-mail / phone number is now REFUSED outright (like a bad word), instead of being
--    silently inserted as 'held' and left stuck there forever — that status is never re-checked by
--    anything, so a link-containing post had no way to ever become visible again.
-- 2. Adds an index so the daily-post-limit check (run on every submit attempt, successful or not)
--    stays cheap regardless of how many rows exist or how many times someone retries.

create or replace function public.feature_text_has_contact(p_text text) returns boolean
language sql immutable set search_path = public as $$
  select lower(coalesce(p_text, '')) ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|ly|me|xyz)\y|@[a-z0-9_.]{3,}|[0-9][0-9 ()+.-]{8,}[0-9])'
$$;

-- No longer decides 'held' at insert time (contact info is refused before this ever runs); kept only
-- so nothing else that may reference it breaks.
create or replace function public.feature_text_status(p_text text) returns text
language sql immutable set search_path = public as $$
  select 'pending'
$$;

create index if not exists feature_requests_user_created_idx on public.feature_requests (user_id, created_at);
create index if not exists feature_comments_user_created_idx on public.feature_comments (user_id, created_at);

create or replace function public.feature_requests_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.title := regexp_replace(btrim(new.title), '\s+', ' ', 'g');
  new.body  := btrim(coalesce(new.body, ''));
  new.author_tag := upper(substr(md5(new.user_id::text || ':zelo'), 1, 6));
  new.vote_count := 0;
  if public.feature_text_rude(new.title || ' ' || new.body) then raise exception 'zelo:inappropriate'; end if;
  if public.feature_text_has_contact(new.title || ' ' || new.body) then raise exception 'zelo:has_link'; end if;
  if exists (select 1 from public.feature_requests r where r.status in ('live', 'pending') and lower(r.title) = lower(new.title)) then
    raise exception 'zelo:duplicate';
  end if;
  if (select count(*) from public.feature_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 3 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := 'pending';
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
  if public.feature_text_has_contact(new.body) then raise exception 'zelo:has_link'; end if;
  if (select count(*) from public.feature_comments c where c.user_id = new.user_id and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'zelo:daily_limit';
  end if;
  new.status := 'pending';
  new.pending_since := now();
  new.moderation_tries := 0;
  return new;
end $$;

create or replace function public.update_feature_request(p_request uuid, p_title text, p_body text)
returns table (id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text; b text;
begin
  if uid is null then raise exception 'zelo:signed_out'; end if;
  t := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  b := btrim(coalesce(p_body, ''));
  if char_length(t) not between 8 and 120 or char_length(b) > 2000 then raise exception 'zelo:invalid'; end if;
  if public.feature_text_rude(t || ' ' || b) then raise exception 'zelo:inappropriate'; end if;
  if public.feature_text_has_contact(t || ' ' || b) then raise exception 'zelo:has_link'; end if;
  if not exists (select 1 from public.feature_requests r where r.id = p_request and r.user_id = uid) then raise exception 'zelo:not_found'; end if;
  if exists (select 1 from public.feature_requests r where r.id <> p_request and r.status in ('live', 'pending') and lower(r.title) = lower(t)) then raise exception 'zelo:duplicate'; end if;
  update public.feature_requests r
     set title = t, body = b, status = 'pending', edited_at = now(), pending_since = now(), moderation_tries = 0
   where r.id = p_request and r.user_id = uid;
  return query select p_request, 'pending'::text;
end $$;

revoke all on function public.feature_text_has_contact(text) from public, anon, authenticated;

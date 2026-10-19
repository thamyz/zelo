-- Feature Requests, part 5. Run AFTER 20261019100000, 20261019110000, 20261019120000 and 20261019130000. Idempotent.
-- Paste into the SQL editor of the ZELO project (bfxxywxhydxvccusjinm).
--
-- Cost/abuse hardening around Gemini calls:
--   1. Editing a request no longer resets its moderation_tries. Before this, repeatedly editing the
--      SAME post bought unlimited fresh Gemini reviews (3 tries x as many edits as you like).
--      Now a row's lifetime budget is exactly 3 Gemini calls, full stop, however many times it's edited.
--   2. claim_moderation_try(): the edge function used to read moderation_tries, check it was under the
--      cap, THEN write +1 as two separate steps — a classic race. Several concurrent calls for the same
--      row could all read the same stale count and all pass the check before any of them wrote, so the
--      "max 3 tries" cap did not actually bound concurrent Gemini calls. This does the check-and-increment
--      as one atomic SQL UPDATE, which Postgres serializes per row: only ever the first MAX_TRIES callers
--      can succeed, no matter how many arrive at once.

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
     set title = t, body = b, status = 'pending', edited_at = now()
   where r.id = p_request and r.user_id = uid;
  return query select p_request, 'pending'::text;
end $$;

-- Atomically claims one of a row's MAX_TRIES=3 review slots. Returns true (and bumps moderation_tries)
-- only if a slot was still free; false means the cap is already used up, no Gemini call should happen.
-- Called only by the edge function via its service-role client, so it's safe from every other client.
create or replace function public.claim_moderation_try(p_table text, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_table = 'feature_requests' then
    update public.feature_requests set moderation_tries = moderation_tries + 1
      where id = p_id and status = 'pending' and moderation_tries < 3;
  elsif p_table = 'feature_comments' then
    update public.feature_comments set moderation_tries = moderation_tries + 1
      where id = p_id and status = 'pending' and moderation_tries < 3;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.claim_moderation_try(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_moderation_try(text, uuid) to service_role;

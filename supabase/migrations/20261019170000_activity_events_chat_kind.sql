-- Adds the 'chat' kind (a practice-chat message sent, recorded at most once every few minutes) to
-- activity_events, so chatting counts towards the daily streak. Safe to run whether or not
-- 20261019160000 already ran: the constraint is dropped and re-created with the same name.
alter table public.activity_events drop constraint if exists activity_events_kind_check;
alter table public.activity_events
  add constraint activity_events_kind_check check (kind in ('scan', 'reply', 'like', 'chat'));

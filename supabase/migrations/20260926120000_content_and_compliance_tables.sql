-- ================================================================
-- Content / structured-data tables (2026-09-26).
--
-- Separate from PostHog: PostHog gets behavior events only (no content).
-- These tables hold the structured records the product and the
-- compliance story need. Everything is owner-scoped with RLS
-- (auth.uid() = user_id); nothing here is readable by another user or
-- by the anon role.
--
-- NOT applied to the live project by whoever wrote this file — review,
-- then run with `supabase db push` (project bfxxywxhydxvccusjinm).
-- Every statement is idempotent (`if not exists` / `drop policy if
-- exists`), BUT if a table with one of these names already exists live
-- with different columns, `create table if not exists` will silently
-- keep the old shape — diff the live schema first.
--
-- DELIBERATELY NOT STORED: raw pasted text and screenshots. There is no
-- column for input content anywhere below (generated_replies keeps only
-- the input *source* — text/screenshot — and the AI output). That is what
-- keeps the raw-input retention question moot; if it is ever stored, a
-- retention job must be decided and built first.
-- ================================================================

-- ---------------------------------------------------------------
-- generated_replies — the AI suggestions Zelo produces
-- ---------------------------------------------------------------
create table if not exists public.generated_replies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  input_source   text not null check (input_source in ('text', 'screenshot')),
  tone           text not null,
  generated_text text not null,
  created_at     timestamptz not null default now(),
  was_favorited  boolean not null default false,
  was_copied     boolean not null default false
);
create index if not exists generated_replies_user_created_idx
  on public.generated_replies (user_id, created_at desc);

-- ---------------------------------------------------------------
-- onboarding_responses — the actual answers to onboarding questions
-- (multi-select answers: store as a JSON array string in answer_value)
-- ---------------------------------------------------------------
create table if not exists public.onboarding_responses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  question_key text not null,
  answer_value text not null,
  created_at   timestamptz not null default now()
);
create index if not exists onboarding_responses_user_idx
  on public.onboarding_responses (user_id, question_key);

-- ---------------------------------------------------------------
-- consent_records — compliance proof. APPEND-ONLY: users can insert and
-- read their own rows, never update or delete them (no such policies).
-- No FK to auth.users on purpose: the proof must survive account
-- deletion (no ON DELETE CASCADE). Confirm this with counsel.
-- ---------------------------------------------------------------
create table if not exists public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  consent_type   text not null,          -- e.g. ai_processing, sensitive_content, analytics
  granted        boolean not null,
  "timestamp"    timestamptz not null default now(),
  policy_version text not null
);
create index if not exists consent_records_user_idx
  on public.consent_records (user_id, consent_type, "timestamp" desc);

-- ---------------------------------------------------------------
-- referrals — who invited who. referred_user_id is null until signup.
-- Clients may create/read their own link_sent rows; flipping a row to
-- signup_completed must come from a trusted server path (service_role),
-- so there is intentionally no client UPDATE policy.
-- ---------------------------------------------------------------
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_user_id  uuid not null references auth.users (id) on delete cascade,
  referred_user_id  uuid references auth.users (id) on delete set null,
  status            text not null default 'link_sent'
                      check (status in ('link_sent', 'signup_completed')),
  created_at        timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id);
create index if not exists referrals_referred_idx on public.referrals (referred_user_id);

-- ---------------------------------------------------------------
-- reports — reported content (bad reply, persona issue). Users file and
-- read their own; status is moved by staff via service_role.
-- reported_content_id is text because it can be a uuid (a reply) or a
-- static id (a persona such as 'zoe').
-- ---------------------------------------------------------------
create table if not exists public.reports (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  reported_content_type text not null,   -- e.g. reply, persona
  reported_content_id   text,
  reason                text not null,
  created_at            timestamptz not null default now(),
  status                text not null default 'open'
                          check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);
create index if not exists reports_user_idx on public.reports (user_id, created_at desc);

-- ---------------------------------------------------------------
-- account_deletions — deletion requests + reason. Like consent_records:
-- no FK / no cascade so the request record outlives the account; the
-- user can file and read their own, completed_at is set by service_role.
-- ---------------------------------------------------------------
create table if not exists public.account_deletions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  requested_at  timestamptz not null default now(),
  reason        text,
  completed_at  timestamptz
);
create index if not exists account_deletions_user_idx on public.account_deletions (user_id);

-- ================================================================
-- Row Level Security — on for all six, owner-only, nothing for anon.
-- ================================================================
alter table public.generated_replies    enable row level security;
alter table public.onboarding_responses enable row level security;
alter table public.consent_records      enable row level security;
alter table public.referrals            enable row level security;
alter table public.reports              enable row level security;
alter table public.account_deletions    enable row level security;

revoke all on public.generated_replies, public.onboarding_responses, public.consent_records,
              public.referrals, public.reports, public.account_deletions from anon;

-- generated_replies: full owner CRUD (was_favorited / was_copied get updated)
drop policy if exists "generated_replies_select_own" on public.generated_replies;
drop policy if exists "generated_replies_insert_own" on public.generated_replies;
drop policy if exists "generated_replies_update_own" on public.generated_replies;
drop policy if exists "generated_replies_delete_own" on public.generated_replies;
create policy "generated_replies_select_own" on public.generated_replies for select to authenticated using (auth.uid() = user_id);
create policy "generated_replies_insert_own" on public.generated_replies for insert to authenticated with check (auth.uid() = user_id);
create policy "generated_replies_update_own" on public.generated_replies for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generated_replies_delete_own" on public.generated_replies for delete to authenticated using (auth.uid() = user_id);

-- onboarding_responses: owner select/insert/update (answers can be re-given), delete
drop policy if exists "onboarding_responses_select_own" on public.onboarding_responses;
drop policy if exists "onboarding_responses_insert_own" on public.onboarding_responses;
drop policy if exists "onboarding_responses_update_own" on public.onboarding_responses;
drop policy if exists "onboarding_responses_delete_own" on public.onboarding_responses;
create policy "onboarding_responses_select_own" on public.onboarding_responses for select to authenticated using (auth.uid() = user_id);
create policy "onboarding_responses_insert_own" on public.onboarding_responses for insert to authenticated with check (auth.uid() = user_id);
create policy "onboarding_responses_update_own" on public.onboarding_responses for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "onboarding_responses_delete_own" on public.onboarding_responses for delete to authenticated using (auth.uid() = user_id);

-- consent_records: append-only (select + insert only)
drop policy if exists "consent_records_select_own" on public.consent_records;
drop policy if exists "consent_records_insert_own" on public.consent_records;
create policy "consent_records_select_own" on public.consent_records for select to authenticated using (auth.uid() = user_id);
create policy "consent_records_insert_own" on public.consent_records for insert to authenticated with check (auth.uid() = user_id);

-- referrals: referrer creates/reads own; the referred user can read theirs.
-- Only 'link_sent' rows without a referred_user_id can be created by a client.
drop policy if exists "referrals_select_involved" on public.referrals;
drop policy if exists "referrals_insert_own_link" on public.referrals;
create policy "referrals_select_involved" on public.referrals for select to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);
create policy "referrals_insert_own_link" on public.referrals for insert to authenticated
  with check (auth.uid() = referrer_user_id and status = 'link_sent' and referred_user_id is null);

-- reports: file + read own; new reports are always 'open'
drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_select_own" on public.reports for select to authenticated using (auth.uid() = user_id);
create policy "reports_insert_own" on public.reports for insert to authenticated
  with check (auth.uid() = user_id and status = 'open');

-- account_deletions: file + read own; completed_at is service_role only
drop policy if exists "account_deletions_select_own" on public.account_deletions;
drop policy if exists "account_deletions_insert_own" on public.account_deletions;
create policy "account_deletions_select_own" on public.account_deletions for select to authenticated using (auth.uid() = user_id);
create policy "account_deletions_insert_own" on public.account_deletions for insert to authenticated
  with check (auth.uid() = user_id and completed_at is null);

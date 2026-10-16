-- ================================================================
-- Security audit follow-up (2026-09-23).
--
-- Verified live against the project via the Management API before
-- writing this: RLS was already ON for every public table (profiles,
-- scans, threads, matches, messages), each already scoped by
-- `auth.uid() = user_id` (or `= id` for profiles) via existing
-- policies. That part did not need fixing. Two real gaps did:
--
-- 1. `profiles` had SELECT / INSERT / UPDATE policies but no DELETE
--    policy at all. services/auth.js's deleteAccount() calls
--    `zeloSupabase.from('profiles').delete().eq('id', userId)` —
--    with no DELETE policy this silently fails (swallowed by its own
--    try/catch as "best effort"), so the profile row was never
--    actually removed despite the UI promising deletion.
--
-- 2. No rate limiting existed anywhere for the two paid-API edge
--    functions (openai-proxy, deepseek-proxy) — this table + RPC
--    backs the fix added directly in their source.
-- ================================================================

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);


-- ================================================================
-- Rate limiting for the OpenAI / DeepSeek proxy edge functions.
--
-- Each proxy call costs real money (GPT-5.4 mini vision / DeepSeek
-- chat completions), and until now neither function checked who was
-- calling or how often — the public anon key alone was enough to
-- invoke them, unlimited, from anywhere (CORS is wide open on both).
-- This table is written to exclusively by the edge functions
-- themselves via increment_rate_limit(), using their service_role
-- key, which always bypasses RLS — so intentionally NO policies are
-- added here for anon/authenticated: a normal client can't read or
-- write this table at all, directly or otherwise.
-- ================================================================

create table if not exists public.api_rate_limits (
  user_id      uuid not null,
  fn           text not null,
  window_start timestamptz not null,
  count        int not null default 1,
  primary key (user_id, fn, window_start)
);

alter table public.api_rate_limits enable row level security;

-- Atomic "increment and return the new count" — a single round trip so
-- concurrent requests from the same user can't race past the limit via
-- a check-then-write gap. SECURITY DEFINER runs as the function owner
-- (bypassing RLS internally), but execute is revoked from every normal
-- role and granted only to service_role, so only a trusted edge
-- function — never a client holding just the anon key — can call it.
create or replace function public.increment_rate_limit(
  p_user_id      uuid,
  p_fn           text,
  p_window_start timestamptz
) returns int
language sql
security definer
set search_path = public
as $$
  insert into public.api_rate_limits (user_id, fn, window_start, count)
  values (p_user_id, p_fn, p_window_start, 1)
  on conflict (user_id, fn, window_start)
  do update set count = api_rate_limits.count + 1
  returning count;
$$;

revoke all on function public.increment_rate_limit(uuid, text, timestamptz) from public;
revoke all on function public.increment_rate_limit(uuid, text, timestamptz) from anon;
revoke all on function public.increment_rate_limit(uuid, text, timestamptz) from authenticated;
grant execute on function public.increment_rate_limit(uuid, text, timestamptz) to service_role;

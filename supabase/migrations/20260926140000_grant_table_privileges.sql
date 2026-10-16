-- ================================================================
-- Table privileges for the six content/compliance tables (2026-09-26).
--
-- Bug in 20260926120000: it enabled RLS + policies and REVOKEd from anon, but
-- never GRANTed anything to `authenticated`. On this project new tables are not
-- auto-granted to the API roles (the Data API answers 42501 "permission denied
-- for table …" before RLS is even consulted), so every signed-in insert/select
-- from the app was refused.
--
-- Grants are the coarse gate; the RLS policies from the first migration remain the
-- fine gate (owner-only). Each table gets only what its policies allow, so nothing
-- extra is exposed: e.g. consent_records stays append-only (no update/delete).
-- Idempotent — safe to run twice.
-- ================================================================

grant select, insert, update, delete on public.generated_replies    to authenticated;
grant select, insert, update, delete on public.onboarding_responses to authenticated;
grant select, insert                 on public.consent_records      to authenticated;
grant select, insert                 on public.referrals            to authenticated;
grant select, insert                 on public.reports              to authenticated;
grant select, insert                 on public.account_deletions    to authenticated;

-- Trusted server paths (edge functions / the retention job / staff tooling)
grant all on public.generated_replies, public.onboarding_responses, public.consent_records,
             public.referrals, public.reports, public.account_deletions to service_role;

-- LRA hardening Apr 28 2026 — defense-in-depth pass.
--
-- The Apr 15 lra_revoke_anon_privileges migration revoked anon DML on
-- the then-existing 28/29 tables. Three tables added since then
-- (auth_handoff_nonces, client_signals, cp_rf_client_map) inherited
-- the public schema's default grants — anon + authenticated had full
-- DML on them. RLS-enabled-no-policy is supposed to be the second
-- line of defense (zero policies = deny by default), but
-- defense-in-depth says the role grants should also be denied. This
-- brings them into line with the rest of the schema.
--
-- Functional impact: nil. All three tables are accessed exclusively
-- through service_role clients in production code (verified by grep
-- 2026-04-28). Revoking anon + authenticated grants does not affect
-- runtime behaviour; it just closes the latent attack surface if RLS
-- was ever accidentally disabled or a policy was misconfigured.

REVOKE ALL ON public.auth_handoff_nonces FROM anon, authenticated;
REVOKE ALL ON public.client_signals       FROM anon, authenticated;
REVOKE ALL ON public.cp_rf_client_map     FROM anon, authenticated;

-- These per-role REVOKES on the trigger functions were superseded by
-- the follow-up migration `lra_revoke_security_definer_public_execute`
-- after we discovered EXECUTE was actually held by PUBLIC, not the
-- per-role grants. Kept here for the historical record; the real fix
-- is in the next migration.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()  FROM anon, authenticated;

-- LRA hardening Apr 28 2026 (cont.) — REVOKE EXECUTE FROM PUBLIC.
--
-- Previous revoke targeted anon + authenticated specifically, but
-- PostgreSQL grants EXECUTE to PUBLIC by default on every function
-- created with default privileges. anon and authenticated inherit
-- from PUBLIC, so the per-role revoke was a no-op. The Supabase
-- advisor `*_security_definer_function_executable` is keyed off the
-- PUBLIC EXECUTE grant. Revoking it from PUBLIC is the actual fix.
--
-- After this migration: only `service_role` (and the postgres owner
-- via SECURITY DEFINER) can call these functions directly. They still
-- fire as triggers on auth.users INSERT and on row UPDATE (their
-- intended invocation paths), because trigger execution does NOT go
-- through EXECUTE privilege checks.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()  FROM PUBLIC;

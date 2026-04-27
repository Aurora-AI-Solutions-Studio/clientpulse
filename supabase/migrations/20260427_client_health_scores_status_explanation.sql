-- Pre-existing bug surfaced by Slice 2B verification.
--
-- src/lib/health/refresh.ts has been upserting `status` + `explanation`
-- into client_health_scores since the Sprint 8A MCP refactor, but those
-- columns were never added to the table. The supabase-js client returns
-- {data, error} on upsert — it does NOT throw — so the broken upsert
-- has been silently failing for weeks. The seed-stamped row stayed
-- frozen because no real refresh ever overwrote it.
--
-- Fix: add the two columns. They mirror the values the HTTP route + the
-- MCP write tool already return to clients (so callers can read the
-- snapshot without re-running compute), and they unblock the upsert so
-- the new signals_score actually persists.

ALTER TABLE public.client_health_scores
  ADD COLUMN IF NOT EXISTS status TEXT NULL
    CHECK (status IS NULL OR status IN ('healthy', 'at-risk', 'critical')),
  ADD COLUMN IF NOT EXISTS explanation TEXT NULL;

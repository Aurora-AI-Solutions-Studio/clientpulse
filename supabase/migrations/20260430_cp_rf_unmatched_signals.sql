-- Sprint 7.9 Slice 7b — track signals that couldn't auto-resolve to a CP client.
--
-- Today /api/signals/ingest drops a signal silently with `accepted:
-- false, reason: 'unmatched_client'` when neither cp_rf_client_map nor
-- exact-name match resolves a ContentPulse client to a CP client. The agency
-- never finds out, the signal disappears, and the Suite-cohesion pitch
-- ("ContentPulse activity rolls into CP health scoring per client") becomes
-- a silent contract.
--
-- This table is a record of every (agency, rf_client) that has tried
-- and failed to resolve. The Suite onboarding wizard reads it to
-- surface a "map these ContentPulse clients" UI; the settings card surfaces an
-- unresolved-count CTA. When the wizard resolves a row, we set
-- resolved_at / resolved_to so the history is audit-able.
--
-- Table + column names keep the legacy `rf_*` token because the schema
-- is shared with the sibling product's writers.
--
-- Idempotent: UNIQUE (agency_id, rf_client_id) — repeated unmatched
-- signals from the same ContentPulse client increment signal_count + bump
-- last_seen_at instead of inserting duplicates.

CREATE TABLE IF NOT EXISTS public.cp_rf_unmatched_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  rf_client_id    TEXT NOT NULL,
  rf_client_name  TEXT NOT NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signal_count    INTEGER NOT NULL DEFAULT 1,
  resolved_at     TIMESTAMPTZ NULL,
  resolved_to     UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
  UNIQUE (agency_id, rf_client_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_rf_unmatched_agency_unresolved
  ON public.cp_rf_unmatched_signals (agency_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.cp_rf_unmatched_signals ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants. Writes happen from /api/signals/ingest
-- via the service client; reads from the wizard go through the same
-- service client + explicit agency_id scope.

COMMENT ON TABLE public.cp_rf_unmatched_signals IS
  'ContentPulse signals that could not auto-resolve to a CP client (no map row, no exact-name match). Surfaced by the Suite onboarding wizard so agencies can map them; resolved_at + resolved_to record the disposition.';

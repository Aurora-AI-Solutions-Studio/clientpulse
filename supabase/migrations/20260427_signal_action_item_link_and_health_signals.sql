-- Slice 2B — ContentPulse→CP Signal Pipeline consumers
--
-- Wires two long-lived columns the slice needs:
--
--   1) action_items.source_signal_id
--      Identifies an action item that was auto-created by the APE in
--      response to a client_signal arrival (pause_resume or content_velocity
--      drop). Backed by a partial UNIQUE index so a re-emit of the same
--      signal cannot create a duplicate item — same idempotency pattern
--      as source_email_token_hash from 20260426_brief_email_branding.sql.
--
--   2) client_health_scores.signals_score
--      Persists the ContentPulse-activity 5th dimension surfaced by the
--      HealthScoringAgent. Sits alongside the existing four subscore
--      columns so the dashboard can render it without touching the
--      JSONB signals payload (which carries the human-readable signal
--      array, not the score).
--
-- Both are additive + idempotent; safe on environments where prior
-- partial migrations may have already created either column.

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS source_signal_id UUID NULL
    REFERENCES public.client_signals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS action_items_source_signal_id_uniq
  ON public.action_items (source_signal_id)
  WHERE source_signal_id IS NOT NULL;

ALTER TABLE public.client_health_scores
  ADD COLUMN IF NOT EXISTS signals_score INTEGER NULL
    CHECK (signals_score IS NULL OR (signals_score >= 0 AND signals_score <= 100));

-- 3) health_score_history.score_type — extend the allowed values to
--    include 'signals' so the new dimension can be persisted alongside
--    the existing four. The original constraint is dropped + recreated
--    because Postgres CHECK constraints aren't ALTERable in place.
DO $$
BEGIN
  ALTER TABLE public.health_score_history
    DROP CONSTRAINT IF EXISTS health_score_history_score_type_check;
  ALTER TABLE public.health_score_history
    ADD CONSTRAINT health_score_history_score_type_check
    CHECK (score_type IN (
      'overall', 'financial', 'relationship', 'delivery', 'engagement', 'signals'
    ));
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Sprint 7B — Stripe webhook idempotency table (LRA §11.7)
-- ═════════════════════════════════════════════════════════════════════════════
-- Stripe retries webhooks aggressively (up to 3 days). Without idempotency
-- guards, retried events re-run subscription updates, double-charge alerts,
-- and other side effects. This table provides a PK-enforced idempotency key
-- per Stripe event_id. The webhook handler:
--   1. Attempts INSERT into this table on event receipt
--   2. On PK conflict → returns 200 immediately (already processed)
--   3. On success → processes the event, then updates processed_at = now()
--
-- Service-role only; RLS enabled with zero policies (internal system table).
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  payload_hash  TEXT
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_at_idx
  ON public.stripe_webhook_events (received_at DESC);

-- RLS: service_role only — no policies intentionally.
-- The webhook handler uses the service role client which bypasses RLS.
-- All other roles (anon, authenticated) get zero rows.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.stripe_webhook_events IS
  'Idempotency guard for Stripe webhook events. Service-role writes only. See LRA §11.7.';
COMMENT ON COLUMN public.stripe_webhook_events.event_id IS
  'Stripe event ID (evt_*). Primary key — duplicate deliveries fail with 23505.';
COMMENT ON COLUMN public.stripe_webhook_events.processed_at IS
  'Set after the event handler completes. NULL indicates an in-flight or failed event.';

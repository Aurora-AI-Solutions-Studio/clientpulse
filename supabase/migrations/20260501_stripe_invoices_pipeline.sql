-- Sprint 7.8 #21 — Stripe → Financial Health Signal pipeline.
--
-- Closes the marketing-vs-code gap on CP's #1 selling point: the
-- landing page promises "Connect Stripe → see portfolio health → 3
-- healthy 1 at risk in your Monday Brief", but the only thing wired
-- pre-this-migration was the OAuth handshake that stores
-- agencies.stripe_connected_account_id. Health refresh fed an empty
-- invoice array to FinancialSignalAgent, so the financial dimension
-- was always neutral.
--
-- This migration adds the storage layer for invoices fetched from
-- each agency's connected Stripe account.

CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  -- client_id is nullable: invoices for Stripe customers that don't
  -- match any CP client are still stored (so we can surface "X% of
  -- your revenue comes from non-CP-tracked clients" later) but won't
  -- contribute to per-client health scores.
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  customer_email TEXT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,           -- draft / open / paid / uncollectible / void
  due_date TIMESTAMPTZ NULL,
  paid_date TIMESTAMPTZ NULL,
  invoice_created_at TIMESTAMPTZ NOT NULL,
  attempted_payments INT NOT NULL DEFAULT 0,
  payment_intent_status TEXT NULL,
  invoice_number TEXT NULL,
  description TEXT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stripe_invoices_agency_invoice_unique UNIQUE (agency_id, stripe_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_agency ON public.stripe_invoices(agency_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_client ON public.stripe_invoices(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer ON public.stripe_invoices(agency_id, stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON public.stripe_invoices(agency_id, status);

-- Track sync state on the agency row so the UI can surface
-- "Last synced X ago" without joining stripe_invoices.
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS stripe_sync_error TEXT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;

-- Agency members can read invoices for their agency. Mirrors the
-- pattern on integration_connections.
DROP POLICY IF EXISTS "Agency members can view invoices" ON public.stripe_invoices;
CREATE POLICY "Agency members can view invoices"
  ON public.stripe_invoices
  FOR SELECT
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am WHERE am.user_id = auth.uid()
    )
  );

-- Writes go via the service-role client (sync route + webhook handler)
-- so we don't need an INSERT/UPDATE/DELETE policy for end users.

COMMENT ON TABLE public.stripe_invoices IS
  'Cached invoices fetched from each agency''s connected Stripe account via Stripe Connect OAuth. Synced via /api/integrations/stripe/sync (manual Sync Now) and /api/stripe/webhook for connected-account events. Feeds FinancialSignalAgent in lib/health/refresh.ts which produces the "Financial" dimension of the client health score surfaced in the Monday Brief.';

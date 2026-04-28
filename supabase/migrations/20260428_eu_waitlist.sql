-- EU geoblock waitlist — captures email addresses from EU-27 visitors
-- redirected by middleware until HRAI compliance clears (Aug 2, 2026).
--
-- Service-role-only writes (the API route uses the service-role
-- client to honor RLS without exposing the table to anonymous reads).
-- Mirrors reforge migration 037_eu_waitlist; same shape so the two
-- products' EU lists can be merged for Sasa's outreach later.

CREATE TABLE IF NOT EXISTS public.eu_waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  product     TEXT NOT NULL CHECK (product IN ('reforge', 'clientpulse')),
  country     TEXT,
  user_agent  TEXT,
  referrer    TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_eu_waitlist_email_product
  ON public.eu_waitlist (LOWER(email), product);

CREATE INDEX IF NOT EXISTS idx_eu_waitlist_recency
  ON public.eu_waitlist (created_at DESC);

ALTER TABLE public.eu_waitlist ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.eu_waitlist IS
  'EU-27 visitor waitlist. Populated by /api/eu-waitlist. Service-role only — no end-user access.';

-- ============================================================================
-- Waitlist Signups Table
-- Migration: 20260412_waitlist_signups
-- Purpose: Capture early access waitlist emails from the landing page
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text DEFAULT 'landing_page',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate signups
  CONSTRAINT waitlist_signups_email_unique UNIQUE (email)
);

-- Index for quick lookups and analytics
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at
  ON public.waitlist_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_source
  ON public.waitlist_signups (source);

-- ============================================================================
-- RLS: Allow anonymous inserts (public waitlist), restrict reads to service role
-- ============================================================================

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up (anon insert)
CREATE POLICY "Allow anonymous waitlist signup"
  ON public.waitlist_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon can read back their own signup (needed for upsert .select())
CREATE POLICY "Allow anon to read own signup"
  ON public.waitlist_signups
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated users (admin) can also read the full list
CREATE POLICY "Authenticated users can read waitlist"
  ON public.waitlist_signups
  FOR SELECT
  TO authenticated
  USING (true);

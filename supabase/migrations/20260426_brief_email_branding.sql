-- Brief email — branding hooks, first-brief tracking, magic-link idempotency.
--
-- Adds:
--   agencies.brand_logo_url     — optional URL rendered as branded header
--   agencies.brand_color        — optional hex (#rrggbb) accent override
--   agencies.first_brief_sent_at — set the first time the auto first-Brief fires
--   action_items.source_email_token_hash — UNIQUE; prevents double-accept from
--                                          the same magic link in the email
--
-- RLS: the new columns inherit existing table policies. No policy changes.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS brand_logo_url      TEXT NULL,
  ADD COLUMN IF NOT EXISTS brand_color         TEXT NULL,
  ADD COLUMN IF NOT EXISTS first_brief_sent_at TIMESTAMPTZ NULL;

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS source_email_token_hash TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS action_items_source_email_token_hash_uniq
  ON public.action_items (source_email_token_hash)
  WHERE source_email_token_hash IS NOT NULL;

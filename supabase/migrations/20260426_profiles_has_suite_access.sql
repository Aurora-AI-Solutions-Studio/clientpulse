-- has_suite_access: real signal for the cross-product switcher and the
-- /api/auth/handoff/issue tier gate. Replaces the imprecise "subscription_plan
-- === 'agency'" proxy. Defaults false — flipped to true only for users who
-- own the Aurora Suite bundle ($999/mo Stripe SKU). Stripe webhook will
-- own this column post-launch (see TODO in lib/stripe webhook handler).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_suite_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.has_suite_access IS
  'True for users who own the Aurora Suite bundle ($999/mo Stripe SKU). Drives the cross-product switcher visibility. Set by the Stripe webhook on Suite checkout completion (TODO post-launch).';

-- Brief opt-out column.
--
-- Set when the user clicks the one-click unsubscribe link in the
-- Monday Brief email (RFC 8058 / Gmail bulk-sender). The hourly cron
-- skips users with a non-NULL value. NULL = subscribed; timestamp =
-- opted out at that moment.
--
-- Adding the column with a NULL default leaves every existing user
-- subscribed — no UPDATE pass needed (per the "never upsert with
-- defaults" rule).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brief_optout_at TIMESTAMPTZ NULL;

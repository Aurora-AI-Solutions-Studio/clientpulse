-- Per-user-local-time Monday Brief send.
--
-- Adds the two columns the brief cron needs to fire at each user's local
-- 8 AM (or whatever hour they pick) instead of one fixed UTC time. The
-- existing cron schedule (Mondays 06:00 UTC) is replaced by an hourly
-- cron in 20260428_monday_brief_hourly_cron.sql so that every UTC hour
-- a tick lands on someone's local 8 AM somewhere in the world.
--
-- Storage column choices:
--   - timezone TEXT NOT NULL DEFAULT 'America/New_York'
--       Most launch customers are US-East-heavy; the East-coast 8 AM is
--       the closest single default to "the launch promise" for an
--       unprofiled user. Browser-detected at signup; settable from
--       /dashboard/settings.
--   - brief_send_hour SMALLINT NOT NULL DEFAULT 8 CHECK 0..23
--       Hour-of-day in the user's local zone. Default 8 AM. Picker on
--       the settings page lets agencies move it.
--
-- Backfill: existing rows take the column DEFAULT in a single ADD
-- COLUMN — no separate UPDATE that could clobber unrelated state.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brief_send_hour SMALLINT NOT NULL DEFAULT 8;

-- Add the range check separately so re-running the migration doesn't
-- error if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_brief_send_hour_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_brief_send_hour_range
      CHECK (brief_send_hour BETWEEN 0 AND 23);
  END IF;
END $$;

-- Update the new-user trigger to honor a browser-detected timezone if
-- the signup form passes one through `options.data.signup_timezone`.
-- Falls back to the column default (`America/New_York`) when absent
-- — same behaviour as users created before this migration.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_agency_id uuid;
  user_name text;
  signup_tz text;
BEGIN
  user_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  signup_tz := NULLIF(new.raw_user_meta_data->>'signup_timezone', '');

  INSERT INTO public.agencies (name, owner_id, created_at, updated_at)
  VALUES (user_name || '''s Agency', new.id, now(), now())
  RETURNING id INTO new_agency_id;

  -- profiles.timezone has a column default; supply it explicitly only
  -- when the signup form told us the browser-resolved zone, so we
  -- don't overwrite the default with NULL.
  IF signup_tz IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, email, agency_id, subscription_plan, subscription_status, timezone, created_at, updated_at)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      new_agency_id,
      'free',
      'active',
      signup_tz,
      now(),
      now()
    );
  ELSE
    INSERT INTO public.profiles (id, full_name, email, agency_id, subscription_plan, subscription_status, created_at, updated_at)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.email),
      new.email,
      new_agency_id,
      'free',
      'active',
      now(),
      now()
    );
  END IF;

  INSERT INTO public.agency_members (agency_id, user_id, role, created_at)
  VALUES (new_agency_id, new.id, 'owner', now());

  RETURN new;
END;
$$;

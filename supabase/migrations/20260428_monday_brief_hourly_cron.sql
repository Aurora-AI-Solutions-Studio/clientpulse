-- Hourly Monday Brief cron (per-user-local-time).
--
-- Replaces the previous "Mondays 06:00 UTC only" job (`0 6 * * 1`) from
-- 20260409_monday_brief_cron.sql with a tick every hour, every day. The
-- /api/cron/monday-brief endpoint now decides per-user whether the brief
-- should fire on this tick by comparing the current UTC instant against
-- each user's (timezone, brief_send_hour) — see lib/brief/schedule.ts.
--
-- Why hourly even on non-Mondays:
--   New Zealand's Monday 8 AM is Sunday 19:00 UTC; California's Monday
--   8 AM is Monday 16:00 UTC; Auckland's Monday 22:00 send-hour user
--   would land on Monday 09:00 UTC. The set of UTC instants that
--   correspond to "Monday 8 AM somewhere in the world" spans Sunday and
--   Tuesday in UTC. An hourly tick all week is the simplest schedule
--   that covers every IANA zone correctly.
--
-- Filter cost is one query against `profiles` per tick (a few hundred
-- rows even at 10K customers); cheap.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the old once-a-week schedule. Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clientpulse-monday-brief') THEN
    PERFORM cron.unschedule('clientpulse-monday-brief');
  END IF;
END $$;

-- Hourly fire-and-forget POST. The endpoint is idempotent w.r.t. each
-- agency (skips re-sending within the same local day) so a duplicate
-- tick from pg_cron will not double-send.
SELECT
  cron.schedule(
    'clientpulse-monday-brief-hourly',
    '0 * * * *',
    $job$
    SELECT
      net.http_post(
        url := 'https://clientpulse.helloaurora.ai/api/cron/monday-brief',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <MONDAY_BRIEF_CRON_SECRET>'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );

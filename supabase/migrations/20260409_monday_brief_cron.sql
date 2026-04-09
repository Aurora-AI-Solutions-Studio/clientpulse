-- Monday Brief cron schedule
--
-- Runs every Monday at 06:00 UTC (= 08:00 Europe/Berlin CEST) and POSTs to
-- the ClientPulse /api/cron/monday-brief endpoint via pg_net.
--
-- Note on secrets:
--   Supabase doesn't allow non-superusers to ALTER DATABASE ... SET, so the
--   bearer token is inlined directly in the cron job body. The value MUST
--   match the MONDAY_BRIEF_CRON_SECRET env var set in Vercel. To rotate the
--   secret, re-run this migration with the new token and redeploy.
--
-- Cron expression note:
--   pg_cron runs in UTC. "0 6 * * 1" fires at 06:00 UTC Mondays, which is
--   08:00 CEST (summer) / 07:00 CET (winter). Acceptable for a weekly digest.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'clientpulse-monday-brief') then
    perform cron.unschedule('clientpulse-monday-brief');
  end if;
end $$;

-- Bearer token is inlined below. Rotate by re-running this migration with
-- the new value AND updating MONDAY_BRIEF_CRON_SECRET in Vercel.
select
  cron.schedule(
    'clientpulse-monday-brief',
    '0 6 * * 1',
    $job$
    select
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

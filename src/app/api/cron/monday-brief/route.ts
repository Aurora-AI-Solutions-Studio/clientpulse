export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { generateAndSendBrief } from '@/lib/brief/send-brief';
import { resolveAppUrl } from '@/lib/url';
import {
  DEFAULT_BRIEF_SEND_HOUR,
  DEFAULT_TIMEZONE,
  shouldSendMondayBrief,
} from '@/lib/brief/schedule';

/**
 * POST /api/cron/monday-brief
 *
 * Triggered by Supabase pg_cron (every hour, all week) via pg_net.
 * Authentication: `Authorization: Bearer ${MONDAY_BRIEF_CRON_SECRET}`.
 *
 * For each agency: load the owner's (timezone, brief_send_hour). If the
 * current UTC instant falls inside that user's local Monday-at-send_hour
 * window, generate + send the brief. Otherwise skip silently. Result
 * payload returns counts split by skip-reason so we can spot bad TZ data
 * in the response without scraping logs.
 *
 * Idempotency: the job is safe to retry within the same hour because the
 * shouldSendMondayBrief window is exactly one hour wide and
 * `monday_briefs` writes are gated by a 23h-back lookup against
 * created_at, so a duplicate cron tick within the hour is a no-op for
 * any agency that already received this week's brief.
 */
export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'cron-monday-brief', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  const secret = process.env.MONDAY_BRIEF_CRON_SECRET;
  if (!secret) {
    console.error('[cron/monday-brief] MONDAY_BRIEF_CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const tickAt = new Date();

  const { data: agencies, error: agenciesError } = await supabase
    .from('agencies')
    .select('id, name, owner_id, brand_logo_url, brand_color');

  if (agenciesError) {
    console.error('[cron/monday-brief] agencies query failed', agenciesError);
    return NextResponse.json({ error: 'Failed to load agencies' }, { status: 500 });
  }

  const appUrl = resolveAppUrl(request);
  const emailTokenSecret = process.env.EMAIL_TOKEN_SECRET;
  if (!emailTokenSecret) {
    console.error('[cron/monday-brief] EMAIL_TOKEN_SECRET not configured');
    return NextResponse.json({ error: 'Email signing key missing' }, { status: 500 });
  }

  const results: Array<{
    agency_id: string;
    agency_name: string | null;
    status:
      | 'sent'
      | 'saved_no_email'
      | 'failed'
      | 'skipped_wrong_local_time'
      | 'skipped_already_sent_this_week'
      | 'skipped_bad_timezone'
      | 'skipped_unsubscribed';
    brief_id?: string;
    error?: string;
  }> = [];

  let sent = 0;
  let saved = 0;
  let failed = 0;
  let skippedWrongTime = 0;
  let skippedAlreadySent = 0;
  let skippedBadTz = 0;
  let skippedUnsubscribed = 0;

  for (const agency of agencies ?? []) {
    const agencyId = agency.id as string;
    const agencyName = (agency.name as string | null) ?? null;

    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, timezone, brief_send_hour, brief_optout_at')
        .eq('id', agency.owner_id)
        .single();

      // Honour one-click unsubscribe before computing the time window —
      // cheaper to skip and surfaces the reason in the response payload.
      if (ownerProfile?.brief_optout_at) {
        skippedUnsubscribed += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'skipped_unsubscribed',
        });
        continue;
      }

      const timezone =
        (ownerProfile?.timezone as string | null) ?? DEFAULT_TIMEZONE;
      const briefSendHour =
        (ownerProfile?.brief_send_hour as number | null) ??
        DEFAULT_BRIEF_SEND_HOUR;

      let inWindow: boolean;
      try {
        inWindow = shouldSendMondayBrief(tickAt, { timezone, briefSendHour });
      } catch (err) {
        console.error(
          '[cron/monday-brief] bad timezone for agency',
          agencyId,
          timezone,
          err,
        );
        skippedBadTz += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'skipped_bad_timezone',
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      if (!inWindow) {
        skippedWrongTime += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'skipped_wrong_local_time',
        });
        continue;
      }

      // Idempotency: skip if a brief for this agency already exists in
      // the last 23 hours. Tighter than 7 days because we want to
      // re-send if we manually clear the row, but loose enough to
      // absorb a duplicate cron tick within the same hour.
      const lookbackIso = new Date(tickAt.getTime() - 23 * 60 * 60 * 1000).toISOString();
      const { data: recentBrief } = await supabase
        .from('monday_briefs')
        .select('id')
        .eq('agency_id', agencyId)
        .gte('created_at', lookbackIso)
        .limit(1)
        .maybeSingle();

      if (recentBrief) {
        skippedAlreadySent += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'skipped_already_sent_this_week',
          brief_id: recentBrief.id as string,
        });
        continue;
      }

      const result = await generateAndSendBrief({
        supabase,
        agency: {
          id: agencyId,
          name: agencyName,
          brandLogoUrl: (agency.brand_logo_url as string | null) ?? null,
          brandColor: (agency.brand_color as string | null) ?? null,
        },
        ownerUserId: agency.owner_id as string,
        to: (ownerProfile?.email as string | null) ?? null,
        send: true,
        appUrl,
        emailTokenSecret,
      });

      if (result.emailStatus === 'sent') {
        sent += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'sent',
          brief_id: result.briefId,
        });
      } else {
        saved += 1;
        results.push({
          agency_id: agencyId,
          agency_name: agencyName,
          status: 'saved_no_email',
          brief_id: result.briefId,
          error:
            result.emailStatus === 'failed'
              ? result.emailError
              : result.emailStatus,
        });
      }
    } catch (err) {
      failed += 1;
      console.error('[cron/monday-brief] agency failed', agencyId, err);
      results.push({
        agency_id: agencyId,
        agency_name: agencyName,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: tickAt.toISOString(),
    processed: agencies?.length ?? 0,
    sent,
    saved_no_email: saved,
    failed,
    skipped_wrong_local_time: skippedWrongTime,
    skipped_already_sent_this_week: skippedAlreadySent,
    skipped_bad_timezone: skippedBadTz,
    skipped_unsubscribed: skippedUnsubscribed,
    results,
  });
}

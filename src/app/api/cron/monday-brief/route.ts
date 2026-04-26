export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { generateAndSendBrief } from '@/lib/brief/send-brief';
import { resolveAppUrl } from '@/lib/url';

/**
 * POST /api/cron/monday-brief
 *
 * Triggered by Supabase pg_cron (Monday 08:00 Europe/Berlin) via pg_net.
 * Authentication: `Authorization: Bearer ${MONDAY_BRIEF_CRON_SECRET}`.
 *
 * Iterates every agency, generates the Monday Brief, persists it, and
 * emails the owner via the shared send pipeline. RLS is bypassed via the
 * service-role client.
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
    status: 'sent' | 'saved_no_email' | 'failed';
    brief_id?: string;
    error?: string;
  }> = [];

  let sent = 0;
  let saved = 0;
  let failed = 0;

  for (const agency of agencies ?? []) {
    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', agency.owner_id)
        .single();

      const result = await generateAndSendBrief({
        supabase,
        agency: {
          id: agency.id as string,
          name: (agency.name as string | null) ?? null,
          brandLogoUrl: (agency.brand_logo_url as string | null) ?? null,
          brandColor: (agency.brand_color as string | null) ?? null,
        },
        to: (ownerProfile?.email as string | null) ?? null,
        send: true,
        appUrl,
        emailTokenSecret,
      });

      if (result.emailStatus === 'sent') {
        sent += 1;
        results.push({
          agency_id: agency.id as string,
          agency_name: (agency.name as string | null) ?? null,
          status: 'sent',
          brief_id: result.briefId,
        });
      } else {
        saved += 1;
        results.push({
          agency_id: agency.id as string,
          agency_name: (agency.name as string | null) ?? null,
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
      console.error('[cron/monday-brief] agency failed', agency.id, err);
      results.push({
        agency_id: agency.id as string,
        agency_name: (agency.name as string | null) ?? null,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    processed: agencies?.length ?? 0,
    sent,
    saved_no_email: saved,
    failed,
    results,
  });
}

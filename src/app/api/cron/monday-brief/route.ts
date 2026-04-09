export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { MondayBriefAgent, renderBriefEmailHtml } from '@/lib/agents/monday-brief-agent';

/**
 * POST /api/cron/monday-brief
 *
 * Triggered by Supabase pg_cron (Monday 08:00 Europe/Berlin) via pg_net.
 * Authentication: `Authorization: Bearer ${MONDAY_BRIEF_CRON_SECRET}`.
 *
 * Iterates every agency, generates the Monday Brief, persists it, and
 * emails the owner via Resend. RLS is bypassed via the service-role client.
 */
export async function POST(request: NextRequest) {
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

  // Pull every agency with an owner
  const { data: agencies, error: agenciesError } = await supabase
    .from('agencies')
    .select('id, name, owner_id');

  if (agenciesError) {
    console.error('[cron/monday-brief] agencies query failed', agenciesError);
    return NextResponse.json({ error: 'Failed to load agencies' }, { status: 500 });
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
      // Look up owner email
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', agency.owner_id)
        .single();

      // Generate brief
      const agent = new MondayBriefAgent(supabase);
      const content = await agent.generate(agency.id);

      // Persist
      const { data: saved_row, error: insertError } = await supabase
        .from('monday_briefs')
        .insert({
          agency_id: agency.id,
          content,
          email_sent: false,
        })
        .select('id')
        .single();

      if (insertError || !saved_row) {
        throw new Error(`insert failed: ${insertError?.message ?? 'unknown'}`);
      }

      // Send via Resend if we have an owner email
      const ownerEmail = ownerProfile?.email as string | undefined;
      if (ownerEmail) {
        const emailed = await sendBriefEmail({
          to: ownerEmail,
          subject: `ClientPulse Monday Brief — Week of ${content.weekOf}`,
          html: renderBriefEmailHtml(content, agency.name ?? undefined),
        });

        if (emailed) {
          await supabase
            .from('monday_briefs')
            .update({ email_sent: true, sent_at: new Date().toISOString() })
            .eq('id', saved_row.id);

          sent += 1;
          results.push({
            agency_id: agency.id,
            agency_name: agency.name,
            status: 'sent',
            brief_id: saved_row.id,
          });
          continue;
        }
      }

      saved += 1;
      results.push({
        agency_id: agency.id,
        agency_name: agency.name,
        status: 'saved_no_email',
        brief_id: saved_row.id,
      });
    } catch (err) {
      failed += 1;
      console.error('[cron/monday-brief] agency failed', agency.id, err);
      results.push({
        agency_id: agency.id,
        agency_name: agency.name,
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

// -----------------------------
// Email delivery (Resend)
// -----------------------------
async function sendBriefEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[cron/monday-brief] RESEND_API_KEY not configured — skipping email');
    return false;
  }
  const from = process.env.RESEND_FROM_EMAIL || 'ClientPulse <brief@helloaurora.ai>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[cron/monday-brief] Resend send failed', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[cron/monday-brief] Resend send error', err);
    return false;
  }
}

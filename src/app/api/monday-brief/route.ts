export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { MondayBriefAgent, renderBriefEmailHtml } from '@/lib/agents/monday-brief-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * GET /api/monday-brief
 * Returns the agency's brief history (most recent first).
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: briefs, error } = await serviceClient
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: 'Failed to load briefs' }, { status: 500 });
    }

    return NextResponse.json(briefs ?? []);
  } catch (err) {
    console.error('[monday-brief GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/monday-brief
 * Generates a new Monday Brief for the current user's agency, persists it,
 * and optionally sends it via email.
 *
 * Body: { send?: boolean }
 */
export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'monday-brief', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, email, serviceClient } = auth.ctx;

    const { data: agency } = await serviceClient
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single();

    const body = await request.json().catch(() => ({}));
    const shouldSend: boolean = Boolean(body?.send);

    // Generate the brief
    const agent = new MondayBriefAgent(serviceClient);
    const content = await agent.generate(agencyId);

    // Persist
    const { data: saved, error: insertError } = await serviceClient
      .from('monday_briefs')
      .insert({
        agency_id: agencyId,
        content,
        email_sent: false,
      })
      .select('id, content, email_sent, sent_at, created_at')
      .single();

    if (insertError) {
      console.error('[monday-brief POST] insert error', insertError);
      return NextResponse.json({ error: 'Failed to persist brief' }, { status: 500 });
    }

    // Optional send via Resend
    if (shouldSend && email) {
      const sent = await sendBriefEmail({
        to: email,
        subject: `ClientPulse Monday Brief — Week of ${content.weekOf}`,
        html: renderBriefEmailHtml(content, (agency?.name as string) ?? undefined),
      });
      if (sent) {
        await serviceClient
          .from('monday_briefs')
          .update({ email_sent: true, sent_at: new Date().toISOString() })
          .eq('id', saved.id);
        saved.email_sent = true;
        saved.sent_at = new Date().toISOString();
      }
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    console.error('[monday-brief POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendBriefEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[monday-brief] RESEND_API_KEY not configured — skipping email');
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
      console.error('[monday-brief] Resend send failed', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[monday-brief] Resend send error', err);
    return false;
  }
}

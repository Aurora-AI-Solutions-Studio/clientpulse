export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { MondayBriefAgent, renderBriefEmailHtml } from '@/lib/agents/monday-brief-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { ensureAgencyForUser } from '@/lib/agency/bootstrap';

/**
 * GET /api/monday-brief
 * Returns the agency's brief history (most recent first).
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Self-heal agency for legacy users (mirrors handle_new_user trigger)
    let { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      await ensureAgencyForUser(supabase, {
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        fullName: profile?.full_name ?? null,
      });
      const { data: healed } = await supabase
        .from('profiles')
        .select('agency_id, email, full_name')
        .eq('id', user.id)
        .maybeSingle();
      profile = healed;
    }

    if (!profile?.agency_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: briefs, error } = await supabase
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('agency_id', profile.agency_id)
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
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Self-heal agency for legacy users (mirrors handle_new_user trigger)
    let { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.agency_id) {
      await ensureAgencyForUser(supabase, {
        userId: user.id,
        email: profile?.email ?? user.email ?? null,
        fullName: profile?.full_name ?? null,
      });
      const { data: healed } = await supabase
        .from('profiles')
        .select('agency_id, email, full_name')
        .eq('id', user.id)
        .maybeSingle();
      profile = healed;
    }

    if (!profile?.agency_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: agency } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('id', profile.agency_id)
      .single();

    const body = await request.json().catch(() => ({}));
    const shouldSend: boolean = Boolean(body?.send);

    // Generate the brief
    const agent = new MondayBriefAgent(supabase);
    const content = await agent.generate(profile.agency_id);

    // Persist
    const { data: saved, error: insertError } = await supabase
      .from('monday_briefs')
      .insert({
        agency_id: profile.agency_id,
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
    if (shouldSend && profile.email) {
      const sent = await sendBriefEmail({
        to: profile.email as string,
        subject: `ClientPulse Monday Brief — Week of ${content.weekOf}`,
        html: renderBriefEmailHtml(content, (agency?.name as string) ?? undefined),
      });
      if (sent) {
        await supabase
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

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { generateAndSendBrief } from '@/lib/brief/send-brief';
import { resolveAppUrl } from '@/lib/url';

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
      .select('id, name, brand_logo_url, brand_color')
      .eq('id', agencyId)
      .single();

    const body = await request.json().catch(() => ({}));
    const shouldSend: boolean = Boolean(body?.send);

    const result = await generateAndSendBrief({
      supabase: serviceClient,
      agency: {
        id: agencyId,
        name: (agency?.name as string | null) ?? null,
        brandLogoUrl: (agency?.brand_logo_url as string | null) ?? null,
        brandColor: (agency?.brand_color as string | null) ?? null,
      },
      to: email,
      send: shouldSend,
      appUrl: resolveAppUrl(request),
      emailTokenSecret: process.env.EMAIL_TOKEN_SECRET,
    });

    // Echo the persisted brief shape that callers used to receive.
    const { data: saved } = await serviceClient
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('id', result.briefId)
      .single();

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    console.error('[monday-brief POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

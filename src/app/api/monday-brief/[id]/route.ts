export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';

/**
 * GET /api/monday-brief/[id]
 * Returns a single brief (scoped to the user's agency).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'monday-brief-id', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  try {
    const { id } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const { data: brief, error } = await supabase
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error || !brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    return NextResponse.json(brief);
  } catch (err) {
    console.error('[monday-brief GET/:id] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

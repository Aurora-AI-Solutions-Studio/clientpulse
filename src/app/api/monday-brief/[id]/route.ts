export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: brief, error } = await supabase
      .from('monday_briefs')
      .select('id, content, email_sent, sent_at, created_at')
      .eq('id', id)
      .eq('agency_id', profile.agency_id)
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

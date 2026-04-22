export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioProposals } from '@/lib/proposals/rollup';
import { resolveTier } from '@/lib/tiers';

// GET /api/proposals?limit=20
//
// Returns the latest Monday Brief's recommendedActions, ranked by
// urgency. Back-end for the dashboard ProposalsCard and the full
// /dashboard/proposals page. Free tier returns empty without DB hit.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id, subscription_plan')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get('limit');
    const limit =
      limitRaw !== null
        ? Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), 100)
        : undefined;

    const tier = resolveTier({ subscription_plan: profile.subscription_plan });
    const result = await getPortfolioProposals(
      supabase,
      profile.agency_id as string,
      tier,
      { limit }
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/proposals GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

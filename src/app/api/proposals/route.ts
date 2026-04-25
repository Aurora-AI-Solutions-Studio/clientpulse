export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioProposals } from '@/lib/proposals/rollup';
import { resolveTier } from '@/lib/tiers';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

// GET /api/proposals?limit=20
//
// Returns the latest Monday Brief's recommendedActions, ranked by
// urgency. Back-end for the dashboard ProposalsCard and the full
// /dashboard/proposals page. Free tier returns empty without DB hit.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, subscriptionPlan, serviceClient } = auth.ctx;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get('limit');
    const limit =
      limitRaw !== null
        ? Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), 100)
        : undefined;

    const tier = resolveTier({ subscription_plan: subscriptionPlan });
    const result = await getPortfolioProposals(serviceClient, agencyId, tier, { limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/proposals GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

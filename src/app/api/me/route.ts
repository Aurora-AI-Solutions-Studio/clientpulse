export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTier, tierDisplayName } from '@/lib/tiers';

// GET /api/me
//
// Session profile summary. Used by the dashboard layout to decide
// onboarding redirect, by the sidebar to render the real tier badge
// (instead of hardcoded "Free"), and by the onboarding wizard to
// check subscription status before advancing.
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'agency_id, subscription_plan, subscription_status, stripe_customer_id, onboarding_completed_at, full_name, email'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'No profile' }, { status: 404 });
    }

    const tier = resolveTier({ subscription_plan: profile.subscription_plan });
    return NextResponse.json({
      userId: user.id,
      email: profile.email ?? user.email ?? null,
      fullName: profile.full_name ?? null,
      agencyId: profile.agency_id ?? null,
      subscriptionPlan: profile.subscription_plan ?? 'free',
      subscriptionStatus: profile.subscription_status ?? 'active',
      stripeCustomerId: profile.stripe_customer_id ?? null,
      onboardingCompletedAt: profile.onboarding_completed_at ?? null,
      tier,
      tierLabel: tierDisplayName(tier),
    });
  } catch (error) {
    console.error('[/api/me GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

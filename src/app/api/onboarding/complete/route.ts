export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/onboarding/complete
//
// Marks profiles.onboarding_completed_at = now() for the authed user.
// Idempotent — re-calling is a no-op that returns the existing
// timestamp. Called from the last step of /dashboard/onboarding.
export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, serviceClient: supabase } = auth.ctx;

    const { data: existing } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (existing?.onboarding_completed_at) {
      return NextResponse.json({
        onboardingCompletedAt: existing.onboarding_completed_at,
        alreadyComplete: true,
      });
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: now })
      .eq('id', userId);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      onboardingCompletedAt: now,
      alreadyComplete: false,
    });
  } catch (error) {
    console.error('[/api/onboarding/complete POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

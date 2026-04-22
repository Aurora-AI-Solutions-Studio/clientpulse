export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  getIntegrationHealth,
  isHealthyOverall,
  unhealthyProviders,
} from '@/lib/integrations/health';

// GET /api/integrations/health
//
// Session-scoped roll-up of gmail/calendar/zoom/stripe health. Used
// by the ConnectionHealthBanner on /dashboard, the settings page,
// and the onboarding wizard.
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const rows = await getIntegrationHealth(
      supabase,
      profile.agency_id as string,
      user.id
    );

    return NextResponse.json({
      health: rows,
      healthy: isHealthyOverall(rows),
      unhealthy: unhealthyProviders(rows),
    });
  } catch (error) {
    console.error('[/api/integrations/health GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  getIntegrationHealth,
  isHealthyOverall,
  unhealthyProviders,
} from '@/lib/integrations/health';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

// GET /api/integrations/health
//
// Session-scoped roll-up of gmail/calendar/zoom/stripe health. Used
// by the ConnectionHealthBanner on /dashboard, the settings page,
// and the onboarding wizard.
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient } = auth.ctx;

    const rows = await getIntegrationHealth(serviceClient, agencyId, userId);

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

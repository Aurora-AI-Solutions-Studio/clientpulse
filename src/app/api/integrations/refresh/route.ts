export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/integrations/refresh  { provider: 'gmail'|'calendar'|'zoom' }
//
// Thin orchestrator — dispatches to the existing per-provider sync
// route. Each sync route already handles expired-token refresh
// internally (see src/app/api/integrations/{provider}/sync/route.ts).
// Stripe has no token-refresh concept in CP; there is no sync route
// to forward to.

const PROVIDER_SYNC_PATH: Record<string, string> = {
  gmail: '/api/integrations/gmail/sync',
  calendar: '/api/integrations/calendar/sync',
  zoom: '/api/integrations/zoom/sync',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const provider = body?.provider;
    if (typeof provider !== 'string' || !PROVIDER_SYNC_PATH[provider]) {
      return NextResponse.json(
        { error: 'provider must be gmail, calendar, or zoom' },
        { status: 400 }
      );
    }

    // Forward to the existing sync route using the session cookie
    // (same origin → Next.js handles auth via the request context).
    const origin = request.nextUrl.origin;
    const syncRes = await fetch(origin + PROVIDER_SYNC_PATH[provider], {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: '{}',
    });

    const syncBody = await syncRes.json().catch(() => ({}));
    return NextResponse.json(syncBody, { status: syncRes.status });
  } catch (error) {
    console.error('[/api/integrations/refresh POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

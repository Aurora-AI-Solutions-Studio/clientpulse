// Aurora Suite Connect-card data feed (Slice 2C-2).
//
// Returns the agency's RF→CP signal pipeline state for the Suite
// integration card on /dashboard/settings. Three numbers drive the
// card:
//   - enabled: whether this user has the cross-product entitlement
//     (`profiles.has_suite_access`). Non-Suite users see a greyed
//     card with an upsell CTA, no live data exposed.
//   - signalsLast7d: how many client_signals rows have been received
//     in the past week. Confidence indicator that RF is actually
//     emitting.
//   - lastSignalAt: most recent emitted_at across all signal types —
//     surfaces "Last signal …" in the card footer.
//   - mappedClientCount: rows in cp_rf_client_map for this agency —
//     proxy for "we know how to attribute incoming signals".
//
// The endpoint is agency-scoped via getAuthedContext (RLS-safe via
// service client + explicit agency_id filter).

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId } = auth.ctx;
    const supabase = createServiceClient();

    // Suite entitlement is on profiles, not the agency record — gates
    // visibility of live signal data without leaking it to non-Suite
    // members of an Agency-tier agency.
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_suite_access')
      .eq('id', userId)
      .maybeSingle();
    const enabled = Boolean(profile?.has_suite_access);

    if (!enabled) {
      return NextResponse.json({
        enabled: false,
        signalsLast7d: 0,
        lastSignalAt: null,
        mappedClientCount: 0,
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: signalsLast7d }, { data: latestRow }, { count: mappedClientCount }] =
      await Promise.all([
        supabase
          .from('client_signals')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .gte('emitted_at', sevenDaysAgo),
        supabase
          .from('client_signals')
          .select('emitted_at')
          .eq('agency_id', agencyId)
          .order('emitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('cp_rf_client_map')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', agencyId),
      ]);

    return NextResponse.json({
      enabled: true,
      signalsLast7d: signalsLast7d ?? 0,
      lastSignalAt: (latestRow?.emitted_at as string | null) ?? null,
      mappedClientCount: mappedClientCount ?? 0,
    });
  } catch (error) {
    console.error('[/api/integrations/suite-status GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

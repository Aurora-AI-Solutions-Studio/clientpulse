// Sprint 7.9 Slice 7b — agency's unresolved RF→CP unmatched-signals.
//
// Reads `cp_rf_unmatched_signals` filtered to the calling agency, returns
// only the unresolved rows + a count of all rows (resolved + unresolved)
// for the settings card. Used by:
//   - the Suite onboarding step UI to enumerate misses to map,
//   - the settings page Suite card to surface a "X RF clients waiting"
//     CTA.
//
// Suite-gated: non-Suite agencies see an empty list (the wizard step
// itself isn't shown for them, but the API returning [] is the
// defense-in-depth answer).

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { createServiceClient } from '@/lib/supabase/service';

export interface UnmatchedRow {
  id: string;
  rf_client_id: string;
  rf_client_name: string;
  signal_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export async function GET(_req: NextRequest) {
  const auth = await getAuthedContext();
  if (!auth.ok) return auth.response;
  const { userId, agencyId } = auth.ctx;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_suite_access')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.has_suite_access) {
    return NextResponse.json({ unresolved: [], unresolved_count: 0 });
  }

  const { data, error } = await supabase
    .from('cp_rf_unmatched_signals')
    .select('id, rf_client_id, rf_client_name, signal_count, first_seen_at, last_seen_at, resolved_at')
    .eq('agency_id', agencyId)
    .order('last_seen_at', { ascending: false });
  if (error) {
    console.error('[/api/suite/unmatched-signals]', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  type Row = UnmatchedRow & { resolved_at: string | null };
  const rows = (data ?? []) as Row[];
  const unresolved = rows
    .filter((r) => r.resolved_at == null)
    .map(({ resolved_at: _omit, ...rest }) => rest);

  return NextResponse.json({
    unresolved,
    unresolved_count: unresolved.length,
  });
}

// Sprint 7.9 Slice 7b — POST /api/suite/unmatched-signals/resolve
//
// Persists a chosen mapping for a previously-unmatched RF client:
//   1) inserts (or upserts) cp_rf_client_map(agency, cp, rf)
//   2) marks the cp_rf_unmatched_signals row resolved_at = NOW(),
//      resolved_to = cp_client_id
//
// Body: { unmatched_id, cp_client_id }
//
// Suite-gated. Validates that both rows belong to the calling agency
// before any write. Idempotent — re-resolving the same row to the
// same client is a no-op.

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { createServiceClient } from '@/lib/supabase/service';

interface ResolveBody {
  unmatched_id?: string;
  cp_client_id?: string;
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'suite_required' }, { status: 403 });
  }

  let body: ResolveBody;
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.unmatched_id || !body.cp_client_id) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Scope-check both rows belong to this agency before any write.
  const { data: unmatched } = await supabase
    .from('cp_rf_unmatched_signals')
    .select('id, agency_id, rf_client_id, resolved_at')
    .eq('id', body.unmatched_id)
    .maybeSingle();
  if (!unmatched || unmatched.agency_id !== agencyId) {
    return NextResponse.json({ error: 'unmatched_not_found' }, { status: 404 });
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, agency_id')
    .eq('id', body.cp_client_id)
    .maybeSingle();
  if (!clientRow || clientRow.agency_id !== agencyId) {
    return NextResponse.json({ error: 'client_not_owned' }, { status: 404 });
  }

  // Upsert the map. Idempotent on (agency_id, rf_client_id) — a re-pick
  // updates the cp_client_id on the existing row instead of duplicating.
  const { error: mapErr } = await supabase
    .from('cp_rf_client_map')
    .upsert(
      {
        agency_id: agencyId,
        rf_client_id: unmatched.rf_client_id as string,
        cp_client_id: body.cp_client_id,
      },
      { onConflict: 'agency_id,rf_client_id' },
    );
  if (mapErr) {
    console.error('[/api/suite/unmatched-signals/resolve] map upsert', mapErr);
    return NextResponse.json({ error: 'map_upsert_failed' }, { status: 500 });
  }

  // Mark the unmatched row resolved.
  const { error: resolveErr } = await supabase
    .from('cp_rf_unmatched_signals')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_to: body.cp_client_id,
    })
    .eq('id', body.unmatched_id);
  if (resolveErr) {
    console.error('[/api/suite/unmatched-signals/resolve] mark resolved', resolveErr);
    return NextResponse.json({ error: 'resolve_update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

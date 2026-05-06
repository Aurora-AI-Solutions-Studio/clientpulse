// ContentPulse→CP Signal Pipeline v1 — ingest webhook (CP side).
//
// Accepts an HMAC-signed signal token from ContentPulse, verifies it, maps the
// ContentPulse client to a CP client (via cp_rf_client_map first, then exact-name
// fallback within the agency), and upserts into client_signals. Table +
// column names keep the legacy `rf_*` token because the schema is shared
// with the sibling product's writers.
//
// Idempotency: client_signals UNIQUE (client_id, signal_type, period)
// — same signal twice = single row, value/metadata refreshed.
//
// Slice 1 ships content_velocity end-to-end. The other 4 signal types
// don't require any code changes here — the verifier accepts all 5
// and the upsert is type-agnostic.

import { NextRequest, NextResponse } from 'next/server';
import { verifySignal } from '@/lib/signals/hmac';
import { createServiceClient } from '@/lib/supabase/service';
import { maybeCreateSignalTriggeredActionItem } from '@/lib/signals/ingest-trigger';
import type { SignalType } from '@/lib/signals/triggers';

interface IngestBody {
  token?: string;
}

export async function POST(req: NextRequest) {
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const token = body.token;
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  const result = verifySignal(token);
  if (!result.ok) {
    return NextResponse.json({ error: `signal_${result.reason}` }, { status: 401 });
  }
  const payload = result.payload;
  const supabase = createServiceClient();

  // Find the agency this signal belongs to. Look up the CP user by the
  // agency_email ContentPulse carried in the payload, then resolve their agency.
  const { data: lookup, error: lookupErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 200,
  });
  if (lookupErr) {
    return NextResponse.json({ error: 'agency_lookup_failed' }, { status: 500 });
  }
  const agencyOwner = lookup.users.find(
    (u) => (u.email ?? '').toLowerCase() === payload.agency_email.toLowerCase(),
  );
  if (!agencyOwner) {
    // No CP account for this ContentPulse agency — silently accept the signal but
    // don't store it. The agency hasn't onboarded to CP yet.
    return NextResponse.json({ accepted: false, reason: 'no_cp_account' });
  }
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('id', agencyOwner.id)
    .maybeSingle();
  if (!ownerProfile?.agency_id) {
    return NextResponse.json({ accepted: false, reason: 'no_agency' });
  }
  const agencyId = ownerProfile.agency_id as string;

  // Resolve which CP client this ContentPulse signal targets. First check the
  // explicit map; fall back to exact-name match within the agency and
  // backfill the map row when a unique match exists.
  let cpClientId: string | null = null;

  const { data: mapRow } = await supabase
    .from('cp_rf_client_map')
    .select('cp_client_id')
    .eq('agency_id', agencyId)
    .eq('rf_client_id', payload.rf_client_id)
    .maybeSingle();
  if (mapRow?.cp_client_id) {
    cpClientId = mapRow.cp_client_id as string;
  } else {
    const { data: nameMatches } = await supabase
      .from('clients')
      .select('id, name')
      .eq('agency_id', agencyId)
      .ilike('name', payload.rf_client_name);
    if (nameMatches && nameMatches.length === 1) {
      cpClientId = nameMatches[0].id as string;
      // Backfill the map so future signals skip the name fallback.
      await supabase.from('cp_rf_client_map').insert({
        agency_id: agencyId,
        cp_client_id: cpClientId,
        rf_client_id: payload.rf_client_id,
      });
    }
  }

  if (!cpClientId) {
    // Record the miss so the Suite onboarding wizard can surface it
    // for manual mapping. Idempotent on (agency_id, rf_client_id) —
    // repeated misses bump last_seen_at + signal_count instead of
    // duplicating. Best-effort: a write failure here doesn't fail the
    // request (ContentPulse's outbox would just retry the signal forever).
    try {
      const { data: existing } = await supabase
        .from('cp_rf_unmatched_signals')
        .select('id, signal_count')
        .eq('agency_id', agencyId)
        .eq('rf_client_id', payload.rf_client_id)
        .maybeSingle();
      if (existing) {
        const { error: updErr } = await supabase
          .from('cp_rf_unmatched_signals')
          .update({
            last_seen_at: new Date().toISOString(),
            signal_count: ((existing.signal_count as number) ?? 1) + 1,
            // Refresh the name in case it changed since the first miss.
            rf_client_name: payload.rf_client_name,
          })
          .eq('id', existing.id as string);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('cp_rf_unmatched_signals').insert({
          agency_id: agencyId,
          rf_client_id: payload.rf_client_id,
          rf_client_name: payload.rf_client_name,
        });
        if (insErr) throw insErr;
      }
    } catch (err) {
      console.warn('[signals/ingest] unmatched-tracking write failed:', err);
    }
    return NextResponse.json({ accepted: false, reason: 'unmatched_client' });
  }

  // Upsert the signal — idempotent on (client_id, signal_type, period).
  const { error: upsertErr } = await supabase
    .from('client_signals')
    .upsert(
      {
        client_id: cpClientId,
        agency_id: agencyId,
        signal_type: payload.signal_type,
        period: payload.period,
        value: payload.value,
        metadata: payload.metadata ?? {},
        emitted_at: payload.emitted_at,
      },
      { onConflict: 'client_id,signal_type,period' },
    );
  if (upsertErr) {
    return NextResponse.json({ error: 'upsert_failed', detail: String(upsertErr) }, { status: 500 });
  }

  // APE auto-trigger — create a re-engagement action_item when a pause
  // or velocity drop arrives. Best-effort: any failure is logged but
  // never propagated to ContentPulse (the ingest must not 5xx, otherwise ContentPulse's
  // outbox retry loop will hammer the route forever).
  const triggerResult = await maybeCreateSignalTriggeredActionItem({
    supabase,
    agencyId,
    clientId: cpClientId,
    signalType: payload.signal_type as SignalType,
    period: payload.period,
    value: payload.value,
  });
  if (triggerResult.outcome === 'error') {
    console.warn(
      '[signals/ingest] APE auto-trigger failed:',
      triggerResult.message,
    );
  }

  return NextResponse.json({
    accepted: true,
    client_id: cpClientId,
    trigger: triggerResult,
  });
}

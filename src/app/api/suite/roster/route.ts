// Sprint 7.9 Slice 7b — POST /api/suite/roster
//
// Cross-product roster RPC. Called by ReForge's /api/suite/clients to
// hydrate the RF /clients page (and, post-Slice-7b, the write-as-client
// picker in /repurpose). Authenticated by HMAC token signed with
// AURORA_SUITE_HANDOFF_SECRET — same trust pattern as the signal
// pipeline. The token's `agency_email` field is the only authority for
// scoping; we look the user up by that email and return only their
// agency's clients.
//
// Returns:
//   200 { clients, has_cp_account: true } when the agency exists in CP.
//   404 { error: 'no_cp_account' } when no CP user matches the email.
//   401 { error: 'roster_<reason>' } on bad/expired/missing token.
//   500 on unexpected DB errors.

import { NextRequest, NextResponse } from 'next/server';
import { verifyRosterToken } from '@/lib/suite/roster';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

interface RosterRequestBody {
  token?: string;
}

export interface RosterClient {
  cp_client_id: string;
  name: string;
  status: string | null;
  health_score: number | null;
  last_signal_at: string | null;
}

export async function POST(req: NextRequest) {
  let body: RosterRequestBody;
  try {
    body = (await req.json()) as RosterRequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const verified = verifyRosterToken(body.token);
  if (!verified.ok) {
    return NextResponse.json(
      { error: `roster_${verified.reason}` },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();

  // Look up the CP user by email.
  let lookupResult: { users: Array<{ id: string; email?: string | null }> };
  try {
    const { data: page1, error: lookupErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (lookupErr) throw lookupErr;
    lookupResult = page1 as { users: Array<{ id: string; email?: string | null }> };
  } catch (err) {
    console.error('[/api/suite/roster] auth.admin.listUsers failed:', err);
    return NextResponse.json({ error: 'agency_lookup_failed' }, { status: 500 });
  }

  const user = lookupResult.users.find(
    (u) => (u.email ?? '').toLowerCase() === verified.payload.agency_email,
  );
  if (!user) {
    return NextResponse.json(
      { error: 'no_cp_account', has_cp_account: false, clients: [] },
      { status: 404 },
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('id', user.id)
    .maybeSingle();
  const agencyId = profile?.agency_id as string | undefined;
  if (!agencyId) {
    // CP account exists but has no agency yet — still has_cp_account true,
    // just an empty roster. The RF page will render the empty state.
    return NextResponse.json({ has_cp_account: true, clients: [] });
  }

  // Pull the agency's clients + their latest health snapshot + the most
  // recent client_signals.emitted_at per client. Three small queries
  // beats one giant join here — RLS-bypass via service client + explicit
  // agency_id scope keeps it safe.
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, status')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true });
  if (clientsErr) {
    console.error('[/api/suite/roster] clients query failed:', clientsErr);
    return NextResponse.json({ error: 'clients_query_failed' }, { status: 500 });
  }

  const clientIds = (clients ?? []).map((c) => c.id as string);
  let healthByClient = new Map<string, number>();
  let lastSignalByClient = new Map<string, string>();

  if (clientIds.length > 0) {
    const [{ data: healthRows }, { data: signalRows }] = await Promise.all([
      supabase
        .from('client_health_scores')
        .select('client_id, overall_score')
        .in('client_id', clientIds),
      supabase
        .from('client_signals')
        .select('client_id, emitted_at')
        .in('client_id', clientIds)
        .order('emitted_at', { ascending: false }),
    ]);

    for (const row of (healthRows ?? []) as Array<{
      client_id: string;
      overall_score: number | null;
    }>) {
      // health_scores may have multiple rows per client over time; first
      // hit is fine for our purpose since we just want the latest snapshot
      // by row order. The schema doesn't guarantee a single row, so this
      // is a best-effort surface, not a billing-critical figure.
      if (!healthByClient.has(row.client_id) && row.overall_score != null) {
        healthByClient.set(row.client_id, row.overall_score);
      }
    }
    for (const row of (signalRows ?? []) as Array<{
      client_id: string;
      emitted_at: string;
    }>) {
      if (!lastSignalByClient.has(row.client_id)) {
        lastSignalByClient.set(row.client_id, row.emitted_at);
      }
    }
  }

  const out: RosterClient[] = (clients ?? []).map((c) => ({
    cp_client_id: c.id as string,
    name: (c.name as string) ?? 'Unnamed client',
    status: ((c as Record<string, unknown>).status as string | null) ?? null,
    health_score: healthByClient.get(c.id as string) ?? null,
    last_signal_at: lastSignalByClient.get(c.id as string) ?? null,
  }));

  return NextResponse.json({ has_cp_account: true, clients: out });
}

// Per-client signals read endpoint. Returns the most-recent value per
// signal_type for the given client, scoped by the authed user's agency.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthedContext();
  if (!auth.ok) return auth.response;
  const { agencyId, serviceClient: admin } = auth.ctx;

  const { id: clientId } = await context.params;

  // Verify the client belongs to the user's agency before exposing its
  // signals — defense in depth even though the join below would
  // otherwise filter on agency_id.
  const { data: client } = await admin
    .from('clients')
    .select('id, name, agency_id')
    .eq('id', clientId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: signals, error } = await admin
    .from('client_signals')
    .select('signal_type, period, value, metadata, emitted_at')
    .eq('client_id', clientId)
    .order('emitted_at', { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  // Latest per signal_type for the headline cards.
  const latest = new Map<string, (typeof signals)[number]>();
  for (const s of signals ?? []) {
    if (!latest.has(s.signal_type)) latest.set(s.signal_type, s);
  }

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    latest: Object.fromEntries(latest),
    timeline: signals ?? [],
  });
}

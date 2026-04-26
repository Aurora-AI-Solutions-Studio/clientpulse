export const dynamic = 'force-dynamic';

// HRAI Art 14 (Human Oversight) — manual override of a computed health score.
//
// POST body: { score: 0..100 (integer), reason: non-empty string }
// Behavior:
//   - Verifies the client belongs to the authed agency
//   - Loads the most recent client_health_scores row (the active score)
//   - Stamps override_score / override_reason / overridden_by / overridden_at
//   - Returns the updated effective score
// DELETE clears the override (reverts to the computed value).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

interface OverrideBody {
  score?: unknown;
  reason?: unknown;
}

const MIN_REASON = 5;
const MAX_REASON = 500;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clientId } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, userId, serviceClient: supabase } = auth.ctx;

    const body = (await request.json().catch(() => ({}))) as OverrideBody;
    const score = Number(body.score);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return NextResponse.json(
        { error: 'score must be an integer between 0 and 100' },
        { status: 400 },
      );
    }
    if (reason.length < MIN_REASON || reason.length > MAX_REASON) {
      return NextResponse.json(
        { error: `reason must be ${MIN_REASON}–${MAX_REASON} characters` },
        { status: 400 },
      );
    }

    // Ownership check
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .maybeSingle();
    if (clientErr) {
      return NextResponse.json({ error: 'Failed to verify client' }, { status: 500 });
    }
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Load latest score row
    const { data: latest } = await supabase
      .from('client_health_scores')
      .select('id')
      .eq('client_id', clientId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) {
      return NextResponse.json(
        { error: 'No computed score yet; cannot override before first compute' },
        { status: 409 },
      );
    }

    const overriddenAt = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('client_health_scores')
      .update({
        override_score: score,
        override_reason: reason,
        overridden_by: userId,
        overridden_at: overriddenAt,
      })
      .eq('id', latest.id)
      .select(
        'overall_score, override_score, override_reason, overridden_by, overridden_at, computed_at',
      )
      .single();

    if (updateErr || !updated) {
      console.error('[health/override POST] update failed', updateErr);
      return NextResponse.json({ error: 'Failed to apply override' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      effectiveScore: updated.override_score ?? updated.overall_score,
      overriddenAt: updated.overridden_at,
      reason: updated.override_reason,
    });
  } catch (err) {
    console.error('[health/override POST] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clientId } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { data: latest } = await supabase
      .from('client_health_scores')
      .select('id')
      .eq('client_id', clientId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return NextResponse.json({ ok: true });

    const { error: clearErr } = await supabase
      .from('client_health_scores')
      .update({
        override_score: null,
        override_reason: null,
        overridden_by: null,
        overridden_at: null,
      })
      .eq('id', latest.id);

    if (clearErr) {
      return NextResponse.json({ error: 'Failed to clear override' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[health/override DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

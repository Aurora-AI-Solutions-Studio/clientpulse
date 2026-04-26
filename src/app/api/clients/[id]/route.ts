export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { Client, ClientUpdateInput, HealthScore } from '@/types/client';

interface HealthScoreRow {
  overall_score: number;
  financial_score: number | null;
  relationship_score: number | null;
  delivery_score: number | null;
  engagement_score: number | null;
  computed_at: string;
  override_score: number | null;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
}

function mapHealthScore(row: HealthScoreRow | null): HealthScore | undefined {
  if (!row) return undefined;
  const overall = row.override_score ?? row.overall_score ?? 0;
  return {
    overall,
    breakdown: {
      financial: row.financial_score ?? 0,
      relationship: row.relationship_score ?? 0,
      delivery: row.delivery_score ?? 0,
      engagement: row.engagement_score ?? 0,
    },
    lastUpdated: row.overridden_at ?? row.computed_at,
    status: overall >= 70 ? 'healthy' : overall >= 40 ? 'at-risk' : 'critical',
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (clientError) {
      console.error('[clients/[id] GET] client query failed', clientError);
      return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
    }
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Latest health score (single row).
    const { data: healthRow } = await supabase
      .from('client_health_scores')
      .select(
        'overall_score, financial_score, relationship_score, delivery_score, engagement_score, computed_at, override_score, override_reason, overridden_by, overridden_at',
      )
      .eq('client_id', id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const mapped: Client = {
      id: client.id,
      name: client.name,
      company: client.company_name,
      contactEmail: client.contact_email,
      monthlyRetainer: client.monthly_retainer,
      serviceType: client.service_type,
      healthScore: mapHealthScore(healthRow as HealthScoreRow | null),
      status: client.status,
      lastMeetingDate: undefined,
      notes: client.notes,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
      agencyId: client.agency_id,
    };

    return NextResponse.json(mapped);
  } catch (err) {
    console.error('[clients/[id] GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const { data: existing, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body: ClientUpdateInput = await request.json();
    const updateData: Record<string, string | number | boolean | null> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.company !== undefined) updateData.company_name = body.company;
    if (body.contactEmail !== undefined) updateData.contact_email = body.contactEmail;
    if (body.monthlyRetainer !== undefined) updateData.monthly_retainer = body.monthlyRetainer;
    if (body.serviceType !== undefined) updateData.service_type = body.serviceType;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error: updateError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
    }

    const mapped: Client = {
      id: updated.id,
      name: updated.name,
      company: updated.company_name,
      contactEmail: updated.contact_email,
      monthlyRetainer: updated.monthly_retainer,
      serviceType: updated.service_type,
      healthScore: undefined,
      status: updated.status,
      lastMeetingDate: undefined,
      notes: updated.notes,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      agencyId: updated.agency_id,
    };
    return NextResponse.json(mapped);
  } catch (err) {
    console.error('[clients/[id] PUT] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[clients/[id] DELETE] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

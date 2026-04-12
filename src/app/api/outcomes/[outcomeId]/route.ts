export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { outcomeId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const agencyId = profile.agency_id as string;

    const { data: outcome, error: fetchError } = await supabase
      .from('client_outcomes')
      .select(
        `
        id,
        client_id,
        outcome_type,
        outcome_date,
        previous_retainer,
        new_retainer,
        reason,
        notes,
        health_score_at_outcome,
        churn_prediction_at_outcome,
        health_breakdown_at_outcome,
        recorded_by,
        created_at,
        clients(id, name, company_name)
      `
      )
      .eq('id', params.outcomeId)
      .eq('agency_id', agencyId)
      .single();

    if (fetchError || !outcome) {
      return NextResponse.json(
        { error: 'Outcome not found' },
        { status: 404 }
      );
    }

    const mapped = {
      id: outcome.id,
      clientId: outcome.client_id,
      clientName: (outcome.clients as unknown as { name: string })?.name,
      outcomeType: outcome.outcome_type,
      outcomeDate: outcome.outcome_date,
      previousRetainer: outcome.previous_retainer,
      newRetainer: outcome.new_retainer,
      reason: outcome.reason,
      notes: outcome.notes,
      healthScoreAtOutcome: outcome.health_score_at_outcome,
      churnPredictionAtOutcome: outcome.churn_prediction_at_outcome,
      healthBreakdownAtOutcome: outcome.health_breakdown_at_outcome,
      recordedBy: outcome.recorded_by,
      createdAt: outcome.created_at,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching outcome:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { outcomeId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const agencyId = profile.agency_id as string;

    // Verify outcome belongs to agency
    const { data: existingOutcome, error: checkError } = await supabase
      .from('client_outcomes')
      .select('id')
      .eq('id', params.outcomeId)
      .eq('agency_id', agencyId)
      .single();

    if (checkError || !existingOutcome) {
      return NextResponse.json(
        { error: 'Outcome not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { notes, reason } = body;

    // Only allow updating notes and reason
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (reason !== undefined) {
      updates.reason = reason;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('client_outcomes')
      .update(updates)
      .eq('id', params.outcomeId)
      .eq('agency_id', agencyId)
      .select(
        `
        id,
        client_id,
        outcome_type,
        outcome_date,
        previous_retainer,
        new_retainer,
        reason,
        notes,
        health_score_at_outcome,
        churn_prediction_at_outcome,
        health_breakdown_at_outcome,
        recorded_by,
        created_at,
        clients(id, name, company_name)
      `
      )
      .single();

    if (updateError) {
      console.error('Error updating outcome:', updateError);
      return NextResponse.json(
        { error: 'Failed to update outcome' },
        { status: 500 }
      );
    }

    const mapped = {
      id: updated.id,
      clientId: updated.client_id,
      clientName: (updated.clients as unknown as { name: string })?.name,
      outcomeType: updated.outcome_type,
      outcomeDate: updated.outcome_date,
      previousRetainer: updated.previous_retainer,
      newRetainer: updated.new_retainer,
      reason: updated.reason,
      notes: updated.notes,
      healthScoreAtOutcome: updated.health_score_at_outcome,
      churnPredictionAtOutcome: updated.churn_prediction_at_outcome,
      healthBreakdownAtOutcome: updated.health_breakdown_at_outcome,
      recordedBy: updated.recorded_by,
      createdAt: updated.created_at,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error updating outcome:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { outcomeId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const agencyId = profile.agency_id as string;

    // Verify outcome belongs to agency
    const { data: existingOutcome, error: checkError } = await supabase
      .from('client_outcomes')
      .select('id')
      .eq('id', params.outcomeId)
      .eq('agency_id', agencyId)
      .single();

    if (checkError || !existingOutcome) {
      return NextResponse.json(
        { error: 'Outcome not found' },
        { status: 404 }
      );
    }

    // Delete associated prediction_feedback entries first
    await supabase
      .from('prediction_feedback')
      .delete()
      .eq('outcome_id', params.outcomeId);

    // Delete the outcome
    const { error: deleteError } = await supabase
      .from('client_outcomes')
      .delete()
      .eq('id', params.outcomeId)
      .eq('agency_id', agencyId);

    if (deleteError) {
      console.error('Error deleting outcome:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete outcome' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting outcome:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

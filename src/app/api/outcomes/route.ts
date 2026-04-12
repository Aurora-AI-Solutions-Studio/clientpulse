export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    // Get client_id from query params if provided
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    let query = supabase
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
      .eq('agency_id', agencyId);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data: outcomes, error: fetchError } = await query.order(
      'outcome_date',
      { ascending: false }
    );

    if (fetchError) {
      console.error('Error fetching outcomes:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch outcomes' },
        { status: 500 }
      );
    }

    const mapped = (outcomes || []).map((outcome: any) => ({
      id: outcome.id,
      clientId: outcome.client_id,
      clientName: outcome.clients?.name,
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
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching outcomes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const {
      clientId,
      outcomeType,
      outcomeDate,
      previousRetainer,
      newRetainer,
      reason,
      notes,
    } = body;

    // Validate required fields
    if (!clientId || !outcomeType || !outcomeDate) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: clientId, outcomeType, outcomeDate',
        },
        { status: 400 }
      );
    }

    // Validate outcomeType
    const validOutcomeTypes = [
      'renewed',
      'churned',
      'expanded',
      'downgraded',
      'paused',
    ];
    if (!validOutcomeTypes.includes(outcomeType)) {
      return NextResponse.json(
        { error: 'Invalid outcomeType' },
        { status: 400 }
      );
    }

    // Verify client ownership
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get current health score and churn prediction for this client
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select('overall_score, financial, relationship, delivery, engagement')
      .eq('client_id', clientId)
      .single();

    const { data: churnPrediction } = await supabase
      .from('churn_predictions')
      .select('churn_probability, risk_level, driving_factors')
      .eq('client_id', clientId)
      .eq('agency_id', agencyId)
      .single();

    // Create outcome record
    const { data: outcome, error: outcomeError } = await supabase
      .from('client_outcomes')
      .insert({
        client_id: clientId,
        agency_id: agencyId,
        outcome_type: outcomeType,
        outcome_date: outcomeDate,
        previous_retainer: previousRetainer ?? null,
        new_retainer: newRetainer ?? null,
        reason: reason ?? null,
        notes: notes ?? null,
        health_score_at_outcome: healthScore?.overall_score ?? null,
        churn_prediction_at_outcome: churnPrediction?.churn_probability ?? null,
        health_breakdown_at_outcome: healthScore
          ? {
              financial: healthScore.financial,
              relationship: healthScore.relationship,
              delivery: healthScore.delivery,
              engagement: healthScore.engagement,
            }
          : null,
        recorded_by: user.id,
      })
      .select()
      .single();

    if (outcomeError) {
      console.error('Error creating outcome:', outcomeError);
      return NextResponse.json(
        { error: 'Failed to create outcome' },
        { status: 500 }
      );
    }

    // Create prediction_feedback entry
    // Determine if prediction was correct
    let predictionCorrect = false;
    if (churnPrediction) {
      const churnPredicted = churnPrediction.churn_probability > 50;
      const isNegativeOutcome =
        outcomeType === 'churned' || outcomeType === 'downgraded';
      predictionCorrect = churnPredicted === isNegativeOutcome;
    }

    const { error: feedbackError } = await supabase
      .from('prediction_feedback')
      .insert({
        client_id: clientId,
        agency_id: agencyId,
        predicted_churn_probability:
          churnPrediction?.churn_probability ?? null,
        predicted_risk_level: churnPrediction?.risk_level ?? null,
        actual_outcome: outcomeType,
        prediction_correct: churnPrediction ? predictionCorrect : null,
        driving_factors: churnPrediction?.driving_factors ?? null,
        outcome_id: outcome.id,
      });

    if (feedbackError) {
      console.error('Error creating prediction feedback:', feedbackError);
      // Don't fail the outcome creation if feedback fails
    }

    const mapped = {
      id: outcome.id,
      clientId: outcome.client_id,
      clientName: client.name,
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

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error('Error creating outcome:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

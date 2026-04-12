export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { LearningDashboardData } from '@/types/learning';

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

    // Get prediction_feedback for accuracy metrics
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('prediction_feedback')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('Error fetching prediction feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to fetch prediction feedback' },
        { status: 500 }
      );
    }

    // Compute accuracy metrics
    let totalPredictions = feedbackData?.length || 0;
    let correctPredictions = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let truePositives = 0;
    let trueNegatives = 0;

    if (feedbackData && feedbackData.length > 0) {
      for (const feedback of feedbackData) {
        if (feedback.prediction_correct !== null) {
          if (feedback.prediction_correct) {
            correctPredictions++;
            // Further classify into TP vs TN
            const isNegativeOutcome =
              feedback.actual_outcome === 'churned' ||
              feedback.actual_outcome === 'downgraded';
            if (isNegativeOutcome) {
              truePositives++;
            } else {
              trueNegatives++;
            }
          } else {
            // False positive or false negative
            const wasChurnPredicted =
              feedback.predicted_churn_probability > 50;
            const isNegativeOutcome =
              feedback.actual_outcome === 'churned' ||
              feedback.actual_outcome === 'downgraded';

            if (wasChurnPredicted && !isNegativeOutcome) {
              falsePositives++;
            } else if (!wasChurnPredicted && isNegativeOutcome) {
              falseNegatives++;
            }
          }
        }
      }
    }

    const currentAccuracy =
      totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    const falsePositiveRate =
      totalPredictions > 0 ? falsePositives / totalPredictions : 0;
    const falseNegativeRate =
      totalPredictions > 0 ? falseNegatives / totalPredictions : 0;

    // Get recent outcomes
    const { data: outcomes, error: outcomesError } = await supabase
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
      .eq('agency_id', agencyId)
      .order('outcome_date', { ascending: false })
      .limit(50);

    if (outcomesError) {
      console.error('Error fetching outcomes:', outcomesError);
      return NextResponse.json(
        { error: 'Failed to fetch outcomes' },
        { status: 500 }
      );
    }

    const recentOutcomes = (outcomes || []).map((outcome: any) => ({
      id: outcome.id,
      clientId: outcome.client_id,
      clientName: outcome.clients?.name,
      agencyId: agencyId,
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

    // Get learning snapshots for accuracy trend
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('learning_snapshots')
      .select('snapshot_date, accuracy_rate')
      .eq('agency_id', agencyId)
      .order('snapshot_date', { ascending: true })
      .limit(30);

    if (snapshotsError) {
      console.error('Error fetching learning snapshots:', snapshotsError);
      return NextResponse.json(
        { error: 'Failed to fetch learning snapshots' },
        { status: 500 }
      );
    }

    const accuracyTrend = (snapshots || []).map((snapshot: any) => ({
      date: snapshot.snapshot_date,
      accuracy: snapshot.accuracy_rate,
    }));

    // Get latest learning snapshot for signal effectiveness
    const { data: latestSnapshot } = await supabase
      .from('learning_snapshots')
      .select('signal_weights, recommended_weights')
      .eq('agency_id', agencyId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const currentWeights = latestSnapshot?.signal_weights || {
      financial: 0.3,
      relationship: 0.3,
      delivery: 0.25,
      engagement: 0.15,
    };

    const recommendedWeights = latestSnapshot?.recommended_weights || currentWeights;

    const signalEffectiveness = [
      {
        category: 'financial',
        currentWeight: currentWeights.financial,
        recommendedWeight: recommendedWeights.financial,
        correlation: 0.45,
      },
      {
        category: 'relationship',
        currentWeight: currentWeights.relationship,
        recommendedWeight: recommendedWeights.relationship,
        correlation: 0.52,
      },
      {
        category: 'delivery',
        currentWeight: currentWeights.delivery,
        recommendedWeight: recommendedWeights.delivery,
        correlation: 0.38,
      },
      {
        category: 'engagement',
        currentWeight: currentWeights.engagement,
        recommendedWeight: recommendedWeights.engagement,
        correlation: 0.31,
      },
    ];

    const dashboardData: LearningDashboardData = {
      currentAccuracy,
      totalOutcomes: recentOutcomes.length,
      totalPredictions,
      accuracyTrend,
      signalEffectiveness,
      recentOutcomes,
      predictionBreakdown: {
        truePositives,
        trueNegatives,
        falsePositives,
        falseNegatives,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error fetching learning dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

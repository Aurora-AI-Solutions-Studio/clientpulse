export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';
import { RecursiveLearningAgent } from '@/lib/agents/recursive-learning-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import {
  ClientOutcome,
  PredictiveSignal,
  SignalWeights,
} from '@/types/learning';

export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'learning-snapshot', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    // Fetch all outcomes for this agency
    const { data: outcomesData, error: outcomesError } = await supabase
      .from('client_outcomes')
      .select('*')
      .eq('agency_id', agencyId);

    if (outcomesError) {
      console.error('Error fetching outcomes:', outcomesError);
      return NextResponse.json(
        { error: 'Failed to fetch outcomes' },
        { status: 500 }
      );
    }

    // Map database outcomes to typed format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcomes: ClientOutcome[] = (outcomesData || []).map((outcome: any) => ({
      id: outcome.id,
      clientId: outcome.client_id,
      agencyId: outcome.agency_id,
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

    // Get current signal weights from latest snapshot or use defaults
    const { data: latestSnapshot } = await supabase
      .from('learning_snapshots')
      .select('signal_weights')
      .eq('agency_id', agencyId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    const currentWeights: SignalWeights = latestSnapshot?.signal_weights || {
      financial: 0.3,
      relationship: 0.3,
      delivery: 0.25,
      engagement: 0.15,
    };

    // Get predictive signals from recent health scores (mock)
    const signals: PredictiveSignal[] = [
      {
        signal: 'Payment delays',
        category: 'financial',
        correlation: 0.65,
        occurrences: 12,
      },
      {
        signal: 'Meeting frequency decline',
        category: 'relationship',
        correlation: 0.58,
        occurrences: 18,
      },
      {
        signal: 'Support ticket volume',
        category: 'delivery',
        correlation: 0.42,
        occurrences: 15,
      },
      {
        signal: 'Email engagement',
        category: 'engagement',
        correlation: 0.35,
        occurrences: 10,
      },
      {
        signal: 'Renewal date approaching',
        category: 'financial',
        correlation: 0.71,
        occurrences: 8,
      },
      {
        signal: 'Executive alignment',
        category: 'relationship',
        correlation: 0.62,
        occurrences: 11,
      },
    ];

    // Use RecursiveLearningAgent to analyze
    const agent = new RecursiveLearningAgent();
    const result = agent.analyze({
      outcomes,
      currentWeights,
      signals,
    });

    // Calculate confidence score
    const confidenceScore = agent.computeConfidenceScore(outcomes);

    // Store the learning snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('learning_snapshots')
      .insert({
        agency_id: agencyId,
        snapshot_date: new Date().toISOString(),
        total_predictions: result.snapshot.totalPredictions,
        correct_predictions: result.snapshot.correctPredictions,
        accuracy_rate: result.snapshot.accuracyRate,
        total_outcomes: result.snapshot.totalOutcomes,
        signal_weights: result.snapshot.signalWeights,
        recommended_weights: result.snapshot.recommendedWeights,
        top_predictive_signals: result.snapshot.topPredictiveSignals || [],
        false_positive_rate: result.snapshot.falsePositiveRate || 0,
        false_negative_rate: result.snapshot.falseNegativeRate || 0,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('Error creating learning snapshot:', snapshotError);
      return NextResponse.json(
        { error: 'Failed to create learning snapshot' },
        { status: 500 }
      );
    }

    // Generate report
    const report = agent.generateReport(result);

    const responseData = {
      snapshotId: snapshot.id,
      snapshotDate: snapshot.snapshot_date,
      analysis: {
        totalOutcomes: result.analysis.totalOutcomes,
        churnOutcomes: result.analysis.churnOutcomes,
        renewalOutcomes: result.analysis.renewalOutcomes,
        expandedOutcomes: result.analysis.expandedOutcomes,
        downgradedOutcomes: result.analysis.downgradedOutcomes,
        pausedOutcomes: result.analysis.pausedOutcomes,
      },
      accuracy: {
        overall: result.snapshot.accuracyRate,
        correctPredictions: result.snapshot.correctPredictions,
        totalPredictions: result.snapshot.totalPredictions,
        falsePositiveRate: result.snapshot.falsePositiveRate,
        falseNegativeRate: result.snapshot.falseNegativeRate,
      },
      weightRecommendations: {
        current: result.weightRecommendations.current,
        recommended: result.weightRecommendations.recommended,
        changes: result.weightRecommendations.changes,
        rationale: result.weightRecommendations.rationale,
      },
      signalAnalysis: {
        topPositiveCorrelators: result.signalAnalysis.topPositiveCorrelators,
        topNegativeCorrelators: result.signalAnalysis.topNegativeCorrelators,
        mostCommonSignals: result.signalAnalysis.mostCommonSignals,
      },
      confidenceScore,
      report,
    };

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error('Error generating learning snapshot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

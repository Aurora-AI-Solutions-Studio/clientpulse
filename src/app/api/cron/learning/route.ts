export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { RecursiveLearningAgent } from '@/lib/agents/recursive-learning-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import {
  ClientOutcome,
  PredictiveSignal,
  SignalWeights,
} from '@/types/learning';

/**
 * POST /api/cron/learning
 *
 * Triggered by Supabase pg_cron. Iterates every agency that has client_outcomes,
 * calls RecursiveLearningAgent analysis, and stores a learning_snapshot.
 *
 * Authentication: `Authorization: Bearer ${LEARNING_CRON_SECRET}`.
 * RLS is bypassed via the service-role client.
 */
export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'cron-learning', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  const secret = process.env.LEARNING_CRON_SECRET;
  if (!secret) {
    console.error('[cron/learning] LEARNING_CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all agencies
  const { data: agencies, error: agenciesError } = await supabase
    .from('agencies')
    .select('id, name');

  if (agenciesError) {
    console.error('[cron/learning] agencies query failed', agenciesError);
    return NextResponse.json({ error: 'Failed to load agencies' }, { status: 500 });
  }

  const results: Array<{
    agency_id: string;
    agency_name: string | null;
    status: 'success' | 'no_outcomes' | 'failed';
    snapshot_id?: string;
    error?: string;
  }> = [];

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const agency of agencies ?? []) {
    try {
      // Check if agency has any outcomes
      const { data: outcomesData, error: outcomesError } = await supabase
        .from('client_outcomes')
        .select('*')
        .eq('agency_id', agency.id);

      if (outcomesError) {
        throw new Error(`outcomes query failed: ${outcomesError.message}`);
      }

      if (!outcomesData || outcomesData.length === 0) {
        skipped += 1;
        results.push({
          agency_id: agency.id,
          agency_name: agency.name,
          status: 'no_outcomes',
        });
        continue;
      }

      // Map outcomes to typed format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outcomes: ClientOutcome[] = outcomesData.map((outcome: any) => ({
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
        .eq('agency_id', agency.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      const currentWeights: SignalWeights = latestSnapshot?.signal_weights || {
        financial: 0.3,
        relationship: 0.3,
        delivery: 0.25,
        engagement: 0.15,
      };

      // Get predictive signals from recent health scores (mock for now)
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
      const _confidenceScore = agent.computeConfidenceScore(outcomes);

      // Store the learning snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('learning_snapshots')
        .insert({
          agency_id: agency.id,
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
        .select('id')
        .single();

      if (snapshotError || !snapshot) {
        throw new Error(`snapshot insert failed: ${snapshotError?.message ?? 'unknown'}`);
      }

      succeeded += 1;
      results.push({
        agency_id: agency.id,
        agency_name: agency.name,
        status: 'success',
        snapshot_id: snapshot.id,
      });
    } catch (err) {
      failed += 1;
      console.error('[cron/learning] agency failed', agency.id, err);
      results.push({
        agency_id: agency.id,
        agency_name: agency.name,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  processed = (agencies?.length ?? 0) - skipped;

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    total_agencies: agencies?.length ?? 0,
    processed,
    succeeded,
    skipped,
    failed,
    results,
  });
}

export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ChurnPrediction } from '@/types/alerts';

// In-memory storage for churn predictions
// Structure: Map<agencyId, ChurnPrediction[]>
const churnPredictionsStore = new Map<string, ChurnPrediction[]>();

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID
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

    // Get latest churn predictions for all clients in the agency
    const predictions = churnPredictionsStore.get(agencyId) || [];

    return NextResponse.json(predictions);
  } catch (error) {
    console.error('Error fetching churn predictions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID
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
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Verify client ownership and get client name
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // TODO: In production, run actual churn prediction algorithm using client data
    // For now, generate mock predictions based on client health score
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select('overall_score, status')
      .eq('client_id', clientId)
      .single();

    // Mock churn probability based on health score
    const overallScore = healthScore?.overall_score ?? 50;
    const churnProbability = Math.max(0, Math.min(100, 100 - overallScore));

    // Determine risk level
    let riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    if (churnProbability >= 75) {
      riskLevel = 'critical';
    } else if (churnProbability >= 50) {
      riskLevel = 'high';
    } else if (churnProbability >= 25) {
      riskLevel = 'moderate';
    } else {
      riskLevel = 'low';
    }

    // Generate mock driving factors
    const drivingFactors = [];
    if (overallScore < 40) {
      drivingFactors.push({
        category: 'financial' as const,
        signal: 'Low payment history',
        impact: -15,
        details: 'Client has had late payments in recent months',
      });
    }
    if (overallScore < 50) {
      drivingFactors.push({
        category: 'relationship' as const,
        signal: 'Limited engagement',
        impact: -10,
        details: 'Declining meeting frequency and attendance',
      });
    }

    // Generate mock suggested actions
    const suggestedActions = [];
    if (riskLevel === 'critical' || riskLevel === 'high') {
      suggestedActions.push({
        id: `action_${Date.now()}_1`,
        priority: 'immediate' as const,
        action: 'Schedule Executive QBR',
        rationale: 'Critical engagement recovery needed',
        type: 'qbr' as const,
      });
      suggestedActions.push({
        id: `action_${Date.now()}_2`,
        priority: 'immediate' as const,
        action: 'Check-in call with stakeholders',
        rationale: 'Re-establish relationship and gather concerns',
        type: 'check_in' as const,
      });
    }

    const prediction: ChurnPrediction = {
      clientId,
      clientName: client.name,
      churnProbability,
      riskLevel,
      drivingFactors,
      suggestedActions,
      computedAt: new Date().toISOString(),
    };

    // Store prediction (replace if already exists for this client)
    const predictions = churnPredictionsStore.get(agencyId) || [];
    const existingIndex = predictions.findIndex((p) => p.clientId === clientId);
    if (existingIndex >= 0) {
      predictions[existingIndex] = prediction;
    } else {
      predictions.push(prediction);
    }
    churnPredictionsStore.set(agencyId, predictions);

    return NextResponse.json(prediction, { status: 201 });
  } catch (error) {
    console.error('Error computing churn prediction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

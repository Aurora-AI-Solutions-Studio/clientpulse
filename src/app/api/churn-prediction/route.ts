export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
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

    const { data: predictions, error: fetchError } = await supabase
      .from('churn_predictions')
      .select('*')
      .eq('agency_id', agencyId)
      .order('computed_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching churn predictions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    const mapped = (predictions || []).map((p) => ({
      clientId: p.client_id,
      clientName: p.client_name,
      churnProbability: p.churn_probability,
      riskLevel: p.risk_level,
      drivingFactors: p.driving_factors,
      suggestedActions: p.suggested_actions,
      savePlan: p.save_plan,
      computedAt: p.computed_at,
    }));

    return NextResponse.json(mapped);
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

    // Get health score for mock churn computation
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
        category: 'financial',
        signal: 'Low payment history',
        impact: -15,
        details: 'Client has had late payments in recent months',
      });
    }
    if (overallScore < 50) {
      drivingFactors.push({
        category: 'relationship',
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
        priority: 'immediate',
        action: 'Schedule Executive QBR',
        rationale: 'Critical engagement recovery needed',
        type: 'qbr',
      });
      suggestedActions.push({
        id: `action_${Date.now()}_2`,
        priority: 'immediate',
        action: 'Check-in call with stakeholders',
        rationale: 'Re-establish relationship and gather concerns',
        type: 'check_in',
      });
    }

    // Upsert prediction (replace if already exists for this client in this agency)
    const { data: prediction, error: upsertError } = await supabase
      .from('churn_predictions')
      .upsert(
        {
          agency_id: agencyId,
          client_id: clientId,
          client_name: client.name,
          churn_probability: churnProbability,
          risk_level: riskLevel,
          driving_factors: drivingFactors,
          suggested_actions: suggestedActions,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id,client_id' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting churn prediction:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save prediction' },
        { status: 500 }
      );
    }

    const mapped = {
      clientId: prediction.client_id,
      clientName: prediction.client_name,
      churnProbability: prediction.churn_probability,
      riskLevel: prediction.risk_level,
      drivingFactors: prediction.driving_factors,
      suggestedActions: prediction.suggested_actions,
      savePlan: prediction.save_plan,
      computedAt: prediction.computed_at,
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error('Error computing churn prediction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

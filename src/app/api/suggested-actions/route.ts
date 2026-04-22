export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import {
  SuggestedActionsAgent,
  SuggestedActionsInput,
} from '@/lib/agents/suggested-actions-agent';
import { requireTier, TierLimitError } from '@/lib/tiers';

/**
 * POST /api/suggested-actions
 * Generate AI-powered action recommendations for a client
 * Body: { clientId: string }
 */
export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'suggested-actions', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

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
      .select('agency_id, subscription_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Action Proposal Engine is Pro+ per D-D2.
    try {
      requireTier({ subscription_plan: profile.subscription_plan }, 'pro');
    } catch (err) {
      if (err instanceof TierLimitError) {
        return NextResponse.json(
          { error: err.message, dimension: err.dimension, tier: err.tier },
          { status: err.status }
        );
      }
      throw err;
    }

    const agencyId = profile.agency_id as string;
    const subscriptionPlan = (profile.subscription_plan as 'solo' | 'pro' | 'agency' | null) ?? 'solo';

    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Verify client ownership and get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, service_type, monthly_retainer')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Gather context for the agent
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select(
        'overall_score, financial_score, relationship_score, delivery_score, engagement_score'
      )
      .eq('client_id', clientId)
      .single();

    const currentScore = healthScore?.overall_score ?? 50;
    const healthBreakdown = {
      financial: healthScore?.financial_score ?? 50,
      relationship: healthScore?.relationship_score ?? 50,
      delivery: healthScore?.delivery_score ?? 50,
      engagement: healthScore?.engagement_score ?? 50,
    };

    // Get churn prediction if available
    const { data: churnPrediction } = await supabase
      .from('churn_predictions')
      .select('churn_probability, driving_factors')
      .eq('agency_id', agencyId)
      .eq('client_id', clientId)
      .single();

    const churnProbability = churnPrediction?.churn_probability ?? 50;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churnFactors = ((churnPrediction?.driving_factors as any[]) || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => ({
        category: f.category || 'general',
        signal: f.signal || '',
        details: f.details || '',
      })
    );

    // Get last meeting date
    const { data: lastMeeting } = await supabase
      .from('meetings')
      .select('meeting_date')
      .eq('client_id', clientId)
      .order('meeting_date', { ascending: false })
      .limit(1)
      .single();

    const lastMeetingDaysAgo = lastMeeting
      ? Math.floor(
          (Date.now() - new Date(lastMeeting.meeting_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 30;

    // Prepare agent input
    const agentInput: SuggestedActionsInput = {
      clientId,
      clientName: client.name,
      churnProbability,
      churnFactors,
      currentHealthScore: currentScore,
      healthBreakdown,
      lastMeetingDaysAgo,
      serviceType: client.service_type || 'Unknown',
      monthlyRetainer: client.monthly_retainer || 0,
    };

    let actions;

    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn(
          'ANTHROPIC_API_KEY not set, falling back to mock actions'
        );
        actions = getMockActions(agentInput);
      } else {
        // Sprint 8A M1.1: pass plan so router selects the right model.
        const agent = new SuggestedActionsAgent(subscriptionPlan);
        actions = await agent.generatePrioritizedActions(agentInput);
      }
    } catch (agentError) {
      console.warn('SuggestedActionsAgent failed, using fallback:', agentError);
      actions = getMockActions(agentInput);
    }

    return NextResponse.json(actions, { status: 200 });
  } catch (error) {
    console.error('Error generating suggested actions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Fallback mock actions when API key is missing or agent fails
 */
function getMockActions(input: SuggestedActionsInput) {
  const actions = [];

  if (input.churnProbability >= 60) {
    actions.push({
      id: `action_${input.clientId}_0`,
      priority: 'immediate' as const,
      action: 'Schedule Executive QBR to review partnership health and address concerns',
      rationale: `Churn probability is ${input.churnProbability}% — needs urgent executive alignment`,
      type: 'qbr' as const,
    });
  }

  if (input.healthBreakdown.financial < 50) {
    actions.push({
      id: `action_${input.clientId}_1`,
      priority: 'immediate' as const,
      action: 'Follow up on outstanding invoices and review payment terms',
      rationale: `Financial health score is ${input.healthBreakdown.financial}/100`,
      type: 'invoice_followup' as const,
    });
  }

  if (input.healthBreakdown.relationship < 60) {
    actions.push({
      id: `action_${input.clientId}_2`,
      priority: 'this_week' as const,
      action: 'Schedule stakeholder check-in to re-engage key decision makers',
      rationale: `Relationship score is ${input.healthBreakdown.relationship}/100 — re-engagement needed`,
      type: 'stakeholder_reengagement' as const,
    });
  }

  if (input.lastMeetingDaysAgo > 21) {
    actions.push({
      id: `action_${input.clientId}_3`,
      priority: 'this_week' as const,
      action: `Schedule touchpoint call — last meeting was ${input.lastMeetingDaysAgo} days ago`,
      rationale: 'Communication gap risks client feeling neglected',
      type: 'check_in' as const,
    });
  }

  if (input.healthBreakdown.delivery < 60) {
    actions.push({
      id: `action_${input.clientId}_4`,
      priority: 'this_week' as const,
      action: 'Conduct service delivery quality review and SLA audit',
      rationale: `Delivery health score is ${input.healthBreakdown.delivery}/100`,
      type: 'service_review' as const,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: `action_${input.clientId}_default`,
      priority: 'this_month' as const,
      action: 'Schedule quarterly business review to maintain healthy partnership',
      rationale: 'Proactive engagement helps sustain positive client relationship',
      type: 'qbr' as const,
    });
  }

  return actions;
}

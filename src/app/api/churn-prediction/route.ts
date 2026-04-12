export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { ChurnPredictionAgent, ChurnPredictionInput } from '@/lib/agents/churn-prediction-agent';
import { SlackNotificationAgent, ChurnAlertNotification } from '@/lib/agents/slack-notification-agent';
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

    // Fetch all required data for churn prediction
    let prediction;
    try {
      // Get current health score and breakdown
      const { data: healthScore, error: _healthError } = await supabase
        .from('client_health_scores')
        .select('overall_score, financial_score, relationship_score, delivery_score, engagement_score')
        .eq('client_id', clientId)
        .single();

      const currentScore = healthScore?.overall_score ?? 50;
      const healthBreakdown = {
        financial: healthScore?.financial_score ?? 50,
        relationship: healthScore?.relationship_score ?? 50,
        delivery: healthScore?.delivery_score ?? 50,
        engagement: healthScore?.engagement_score ?? 50,
      };

      // Get health score history (last 6 entries)
      const { data: healthHistory, error: _historyError } = await supabase
        .from('client_health_scores')
        .select('overall_score, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(6);

      const healthScoreHistory = (healthHistory || [])
        .reverse()
        .map(h => ({
          score: h.overall_score,
          date: new Date(h.created_at).toISOString().split('T')[0],
        }));

      // Get recent meeting sentiments (last 5 meetings)
      const { data: meetings, error: _meetingsError } = await supabase
        .from('meetings')
        .select('sentiment_score, created_at, frequency_trend')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(5);

      const recentMeetingSentiments = (meetings || [])
        .reverse()
        .map(m => m.sentiment_score || 5);
      const meetingFrequencyTrend = meetings?.[0]?.frequency_trend ?? 'stable';
      const lastMeetingDaysAgo = meetings?.[0]
        ? Math.floor((Date.now() - new Date(meetings[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      // Get action item stats
      const { data: actionItems, error: _actionsError } = await supabase
        .from('action_items')
        .select('status, due_date')
        .eq('client_id', clientId);

      const now = new Date();
      const actionItemStats = {
        total: (actionItems || []).length,
        completed: (actionItems || []).filter(a => a.status === 'completed').length,
        overdue: (actionItems || []).filter(
          a => a.status !== 'completed' && new Date(a.due_date) < now
        ).length,
      };

      // Get client service info and retainer
      const { data: clientData, error: _clientDataError } = await supabase
        .from('clients')
        .select('monthly_retainer, service_type')
        .eq('id', clientId)
        .single();

      const monthlyRetainer = clientData?.monthly_retainer ?? 0;
      const serviceType = clientData?.service_type ?? 'Unknown';

      // Get overdue invoice count
      const { data: invoices, error: _invoicesError } = await supabase
        .from('invoices')
        .select('status, due_date')
        .eq('client_id', clientId);

      const overdueInvoices = (invoices || []).filter(
        inv => inv.status !== 'paid' && new Date(inv.due_date) < now
      ).length;

      // Prepare input for ChurnPredictionAgent
      const agentInput: ChurnPredictionInput = {
        clientId,
        clientName: client.name,
        currentHealthScore: currentScore,
        healthScoreHistory,
        healthBreakdown,
        recentMeetingSentiments: recentMeetingSentiments.length > 0 ? recentMeetingSentiments : [5],
        actionItemStats,
        lastMeetingDaysAgo,
        monthlyRetainer,
        serviceType,
        overdueInvoices,
        meetingFrequencyTrend,
      };

      // Call ChurnPredictionAgent
      const agent = new ChurnPredictionAgent();
      const agentPrediction = await agent.predictChurn(agentInput);

      prediction = agentPrediction;
    } catch (agentError) {
      console.error('ChurnPredictionAgent error, falling back to mock logic:', agentError);

      // Fallback to mock logic if agent fails or API key not set
      const { data: healthScore } = await supabase
        .from('client_health_scores')
        .select('overall_score, status')
        .eq('client_id', clientId)
        .single();

      const overallScore = healthScore?.overall_score ?? 50;
      const churnProbability = Math.max(0, Math.min(100, 100 - overallScore));

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

      prediction = {
        clientId,
        clientName: client.name,
        churnProbability,
        riskLevel,
        drivingFactors,
        suggestedActions,
        computedAt: new Date().toISOString(),
      };
    }

    // Upsert prediction (replace if already exists for this client in this agency)
    const { data: upsertedPrediction, error: upsertError } = await supabase
      .from('churn_predictions')
      .upsert(
        {
          agency_id: agencyId,
          client_id: prediction.clientId,
          client_name: prediction.clientName,
          churn_probability: prediction.churnProbability,
          risk_level: prediction.riskLevel,
          driving_factors: prediction.drivingFactors,
          suggested_actions: prediction.suggestedActions,
          save_plan: prediction.savePlan,
          computed_at: prediction.computedAt,
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

    // Check if churn probability >= 60 (high risk) and send Slack alert (fire-and-forget)
    if (upsertedPrediction.churn_probability >= 60) {
      // Check if agency has Slack connection with notify_churn_alerts enabled
      const { data: slackConnection } = await supabase
        .from('slack_connections')
        .select('webhook_url')
        .eq('agency_id', agencyId)
        .eq('notify_churn_alerts', true)
        .single();

      if (slackConnection?.webhook_url) {
        // Build the churn alert notification
        const drivingFactors = (upsertedPrediction.driving_factors || [])
          .slice(0, 3)
          .map((f: { signal: string }) => f.signal);

        const suggestedAction = (upsertedPrediction.suggested_actions || []).length > 0
          ? (upsertedPrediction.suggested_actions[0] as { action?: string }).action || 'Schedule QBR'
          : 'Schedule QBR';

        const notification: ChurnAlertNotification = {
          type: 'churn_alert',
          clientName: upsertedPrediction.client_name,
          companyName: upsertedPrediction.client_name,
          churnProbability: upsertedPrediction.churn_probability,
          riskLevel: upsertedPrediction.risk_level as 'critical' | 'high' | 'moderate' | 'low',
          primaryRiskFactors: drivingFactors,
          suggestedAction,
          dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clientpulse.helloaurora.ai'}/dashboard/churn`,
        };

        // Send Slack notification without awaiting (fire-and-forget)
        sendChurnAlertToSlack(slackConnection.webhook_url, notification).catch((err) => {
          console.warn('[churn-prediction] Failed to send Slack alert:', err);
        });
      }
    }

    const mapped = {
      clientId: upsertedPrediction.client_id,
      clientName: upsertedPrediction.client_name,
      churnProbability: upsertedPrediction.churn_probability,
      riskLevel: upsertedPrediction.risk_level,
      drivingFactors: upsertedPrediction.driving_factors,
      suggestedActions: upsertedPrediction.suggested_actions,
      savePlan: upsertedPrediction.save_plan,
      computedAt: upsertedPrediction.computed_at,
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

// ─── Slack Alert Helper ───────────────────────────────────────
async function sendChurnAlertToSlack(
  webhookUrl: string,
  notification: ChurnAlertNotification
): Promise<boolean> {
  const agent = new SlackNotificationAgent(webhookUrl);
  return agent.send(notification);
}

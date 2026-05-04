export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';

export interface ClientReportData {
  agencyInfo: {
    name: string;
    logo?: string;
    branding?: {
      primaryColor?: string;
      accentColor?: string;
    };
  };
  clientInfo: {
    id: string;
    name: string;
    company: string;
    serviceType?: string;
    monthlyRetainer?: number;
    contactEmail?: string;
  };
  healthScore: {
    overall: number;
    status: 'healthy' | 'at-risk' | 'critical' | 'unscored';
    breakdown: {
      financial: number;
      relationship: number;
      delivery: number;
      engagement: number;
    };
    lastUpdated: string;
    previousScore?: number;
    trend?: 'up' | 'down' | 'stable';
  };
  recentMeetings: Array<{
    id: string;
    title: string;
    date: string;
    sentiment: number;
    summary?: string;
  }>;
  recentAlerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    type: string;
    createdAt: string;
  }>;
  churnPrediction: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    primaryRisks: string[];
    estimatedChurnProbability: number;
  };
  suggestedActions: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
  }>;
  engagementMetrics: {
    totalMeetings: number;
    averageSentiment: number;
    engagement: 'high' | 'medium' | 'low';
    lastEngagementDays: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
    generatedAt: string;
  };
}

/**
 * POST /api/reports/client
 * Generate a comprehensive white-label client report
 * Body: { clientId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Fetch agency info
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, name, logo_url, primary_color, accent_color')
      .eq('id', agencyId)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Fetch client info with agency isolation
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company_name, service_type, monthly_retainer, contact_email')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch health score
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select('overall_score, financial_score, relationship_score, delivery_score, engagement_score, computed_at')
      .eq('client_id', clientId)
      .single();

    // Fetch previous health score for trend
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: previousHealth } = await supabase
      .from('health_score_history')
      .select('score')
      .eq('client_id', clientId)
      .eq('score_type', 'overall')
      .lte('recorded_at', oneMonthAgo.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    const currentScore = healthScore?.overall_score || 0;
    const prevScore = previousHealth?.score || currentScore;
    if (currentScore > prevScore + 5) trend = 'up';
    else if (currentScore < prevScore - 5) trend = 'down';

    // Fetch recent meetings (last 5)
    const { data: meetings } = await supabase
      .from('meetings')
      .select(
        `
        id,
        title,
        meeting_date,
        meeting_intelligence (
          sentiment_score,
          summary
        )
      `
      )
      .eq('client_id', clientId)
      .eq('agency_id', agencyId)
      .order('meeting_date', { ascending: false })
      .limit(5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentMeetings = (meetings || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      date: m.meeting_date,
      sentiment: m.meeting_intelligence?.[0]?.sentiment_score || 0.5,
      summary: m.meeting_intelligence?.[0]?.summary,
    }));

    // Fetch recent alerts (last 10)
    const { data: alerts } = await supabase
      .from('alerts')
      .select('id, title, message, severity, type, created_at')
      .eq('client_id', clientId)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentAlerts = (alerts || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      severity: a.severity,
      type: a.type,
      createdAt: a.created_at,
    }));

    // Calculate churn prediction based on health score and risk factors
    const overallHealth = healthScore?.overall_score || 0;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let riskScore = 0;
    const primaryRisks: string[] = [];

    if (overallHealth >= 75) {
      riskScore = 10;
      riskLevel = 'low';
    } else if (overallHealth >= 60) {
      riskScore = 30;
      riskLevel = 'medium';
      if ((healthScore?.relationship_score || 0) < 65) primaryRisks.push('Declining relationship health');
      if ((healthScore?.engagement_score || 0) < 60) primaryRisks.push('Low engagement levels');
    } else if (overallHealth >= 40) {
      riskScore = 60;
      riskLevel = 'high';
      if ((healthScore?.financial_score || 0) < 50) primaryRisks.push('Payment or financial issues');
      if ((healthScore?.delivery_score || 0) < 55) primaryRisks.push('Delivery quality concerns');
      if ((healthScore?.relationship_score || 0) < 50) primaryRisks.push('Strained relationship');
    } else {
      riskScore = 85;
      riskLevel = 'critical';
      primaryRisks.push('Critical health indicators');
      primaryRisks.push('Immediate intervention required');
    }

    // Calculate engagement metrics
    const totalMeetings = meetings?.length || 0;
    const averageSentiment =
      totalMeetings > 0
        ? recentMeetings.reduce((sum, m) => sum + m.sentiment, 0) / recentMeetings.length
        : 0.5;

    let engagementLevel: 'high' | 'medium' | 'low' = 'medium';
    if (totalMeetings >= 2 && averageSentiment >= 0.6) {
      engagementLevel = 'high';
    } else if (totalMeetings < 1 || averageSentiment < 0.4) {
      engagementLevel = 'low';
    }

    // Calculate last engagement days
    let lastEngagementDays = 365;
    if (recentMeetings.length > 0) {
      const lastMeetingDate = new Date(recentMeetings[0].date);
      const now = new Date();
      lastEngagementDays = Math.floor(
        (now.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Generate suggested actions based on health metrics
    const suggestedActions = [];
    if (riskLevel === 'critical' || riskLevel === 'high') {
      suggestedActions.push({
        id: 'action-1',
        title: 'Schedule Executive Alignment',
        description: 'Schedule a high-level meeting to align on expectations and address concerns',
        priority: 'high',
        action: 'Schedule a 60-minute executive alignment meeting',
      });
    }

    if ((healthScore?.relationship_score || 0) < 60) {
      suggestedActions.push({
        id: 'action-2',
        title: 'Improve Relationship Health',
        description: 'Proactive outreach and engagement initiatives to strengthen the partnership',
        priority: 'high',
        action: 'Conduct relationship health assessment',
      });
    }

    if ((healthScore?.delivery_score || 0) < 65) {
      suggestedActions.push({
        id: 'action-3',
        title: 'Review Delivery Standards',
        description: 'Audit current deliverables and service levels against SLA commitments',
        priority: 'high',
        action: 'Conduct delivery quality review',
      });
    }

    if (lastEngagementDays > 30) {
      suggestedActions.push({
        id: 'action-4',
        title: 'Increase Engagement Touchpoints',
        description: 'Add more regular check-ins and collaborative sessions',
        priority: 'medium',
        action: 'Establish bi-weekly touchpoint cadence',
      });
    }

    if ((healthScore?.engagement_score || 0) < 65) {
      suggestedActions.push({
        id: 'action-5',
        title: 'Boost Stakeholder Engagement',
        description: 'Expand engagement strategies to include decision-makers and additional stakeholders',
        priority: 'medium',
        action: 'Identify and engage key stakeholders',
      });
    }

    if (suggestedActions.length === 0) {
      suggestedActions.push({
        id: 'action-maintain',
        title: 'Maintain Momentum',
        description: 'Continue current engagement and service delivery to sustain healthy partnership',
        priority: 'low',
        action: 'Keep existing engagement rhythm',
      });
    }

    // Date range (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const report: ClientReportData = {
      agencyInfo: {
        name: agency.name,
        logo: agency.logo_url || undefined,
        branding: {
          primaryColor: agency.primary_color || '#0066cc',
          accentColor: agency.accent_color || '#00cc99',
        },
      },
      clientInfo: {
        id: client.id,
        name: client.name,
        company: client.company_name,
        serviceType: client.service_type,
        monthlyRetainer: client.monthly_retainer,
        contactEmail: client.contact_email,
      },
      healthScore: {
        overall: Math.round(healthScore?.overall_score || 0),
        status:
          (healthScore?.overall_score || 0) >= 75
            ? 'healthy'
            : (healthScore?.overall_score || 0) >= 60
              ? 'at-risk'
              : 'critical',
        breakdown: {
          financial: Math.round(healthScore?.financial_score || 0),
          relationship: Math.round(healthScore?.relationship_score || 0),
          delivery: Math.round(healthScore?.delivery_score || 0),
          engagement: Math.round(healthScore?.engagement_score || 0),
        },
        lastUpdated: healthScore?.computed_at || new Date().toISOString(),
        previousScore: previousHealth?.score,
        trend,
      },
      recentMeetings,
      recentAlerts,
      churnPrediction: {
        riskLevel,
        riskScore,
        primaryRisks,
        estimatedChurnProbability: riskScore / 100,
      },
      suggestedActions: suggestedActions as { id: string; title: string; description: string; priority: 'low' | 'medium' | 'high'; action: string }[],
      engagementMetrics: {
        totalMeetings,
        averageSentiment: Math.round(averageSentiment * 100) / 100,
        engagement: engagementLevel,
        lastEngagementDays,
      },
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating client report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

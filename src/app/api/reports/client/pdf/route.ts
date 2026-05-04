export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { ClientReportData } from '../route';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';

// pdfkit supports moveDown in text options at runtime but @types/pdfkit doesn't declare it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfTextOpts = PDFKit.Mixins.TextOptions & Record<string, any>;

/**
 * GET /api/reports/client/pdf?clientId=xxx
 * Generate a PDF client report
 * Query: { clientId: string }
 */
export async function GET(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'reports-client-pdf', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;
    const clientId = request.nextUrl.searchParams.get('clientId');

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

    // Generate PDF
    const pdf = await generateClientPDF(report);

    // Prepare filename
    const fileName = `ClientPulse-Report-${report.clientInfo.name.replace(/\s+/g, '-')}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 });
  }
}

async function generateClientPDF(report: ClientReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'letter',
      margin: 40,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const primaryColor = report.agencyInfo.branding?.primaryColor || '#e74c3c';
    const _accentColor = report.agencyInfo.branding?.accentColor || '#34495e';

    // Helper functions
    const addSection = (title: string, y?: number) => {
      if (y) doc.moveTo(50, y).lineTo(550, y).stroke('#cccccc');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a').text(title, { moveDown: true } as PdfTextOpts);
      doc.fontSize(11).font('Helvetica');
    };

    const _addSubsection = (title: string) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text(title, { moveDown: true } as PdfTextOpts);
      doc.font('Helvetica').fontSize(10);
    };

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor(primaryColor).text('Client Health Report', {
      align: 'left',
    });
    doc.fontSize(12).fillColor('#666666').text(report.agencyInfo.name, { moveDown: true } as PdfTextOpts);

    // Client info and date
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Client: ${report.clientInfo.name}`, { moveDown: false } as PdfTextOpts);
    doc.text(`Company: ${report.clientInfo.company || 'N/A'}`, { moveDown: false } as PdfTextOpts);
    doc.text(`Generated: ${new Date(report.dateRange.generatedAt).toLocaleDateString()}`, {
      moveDown: true,
    } as PdfTextOpts);
    doc.moveDown(0.3);

    // Health Score Overview
    addSection('Health Score Overview');
    doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(`${report.healthScore.overall}`, { moveDown: false } as PdfTextOpts);
    doc.fontSize(11).fillColor('#666666').text(`Overall Health Score (${report.healthScore.status})`, {
      moveDown: true,
    } as PdfTextOpts);

    // Breakdown table
    doc.fontSize(10).fillColor('#333333').font('Helvetica');
    const breakdown = report.healthScore.breakdown;
    const scores = [
      { label: 'Financial', value: breakdown.financial },
      { label: 'Relationship', value: breakdown.relationship },
      { label: 'Delivery', value: breakdown.delivery },
      { label: 'Engagement', value: breakdown.engagement },
    ];

    const yPos = doc.y;
    scores.forEach((score, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const xPos = col === 0 ? 50 : 300;
      const newY = yPos + row * 25;

      doc.fontSize(10).text(`${score.label}: ${score.value}`, xPos, newY, { width: 200 });
    });
    doc.moveDown(1.5);

    // Risk Assessment
    addSection('Risk Assessment');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text(`Risk Level: ${report.churnPrediction.riskLevel.toUpperCase()}`, {
      moveDown: true,
    } as PdfTextOpts);
    doc.font('Helvetica').fontSize(10).fillColor('#666666');
    doc.text(`Churn Probability: ${(report.churnPrediction.estimatedChurnProbability * 100).toFixed(0)}%`, {
      moveDown: false,
    } as PdfTextOpts);
    doc.text(`Risk Score: ${report.churnPrediction.riskScore}/100`, { moveDown: true } as PdfTextOpts);

    if (report.churnPrediction.primaryRisks.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text('Primary Risks:', { moveDown: true } as PdfTextOpts);
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      report.churnPrediction.primaryRisks.forEach((risk) => {
        doc.text(`• ${risk}`, { moveDown: true } as PdfTextOpts);
      });
    }
    doc.moveDown(0.3);

    // Engagement Metrics
    addSection('Engagement Metrics');
    doc.fontSize(10).fillColor('#333333').font('Helvetica');
    doc.text(`Total Meetings (90 days): ${report.engagementMetrics.totalMeetings}`, { moveDown: true } as PdfTextOpts);
    doc.text(`Average Sentiment: ${(report.engagementMetrics.averageSentiment * 100).toFixed(0)}%`, {
      moveDown: true,
    } as PdfTextOpts);
    doc.text(`Engagement Level: ${report.engagementMetrics.engagement.toUpperCase()}`, { moveDown: true } as PdfTextOpts);
    doc.text(`Last Engagement: ${report.engagementMetrics.lastEngagementDays} days ago`, { moveDown: true } as PdfTextOpts);

    // Recent Meetings
    if (report.recentMeetings.length > 0) {
      doc.moveDown(0.3);
      addSection('Recent Meetings');
      doc.fontSize(9).fillColor('#333333').font('Helvetica');

      report.recentMeetings.slice(0, 5).forEach((meeting) => {
        const date = new Date(meeting.date).toLocaleDateString();
        const sentiment = Math.round(meeting.sentiment * 100);
        doc.font('Helvetica-Bold').text(`${meeting.title} (${date})`, { moveDown: false } as PdfTextOpts);
        doc.font('Helvetica').fillColor('#666666').text(`Sentiment: ${sentiment}%`, { moveDown: true } as PdfTextOpts);
        if (meeting.summary) {
          doc.fontSize(8).text(meeting.summary, { width: 460, moveDown: true } as PdfTextOpts);
        }
        doc.fontSize(9).moveDown(0.2);
      });
    }

    // Recent Alerts
    if (report.recentAlerts.length > 0) {
      doc.moveDown(0.3);
      addSection('Recent Alerts');
      doc.fontSize(9).fillColor('#333333').font('Helvetica');

      report.recentAlerts.slice(0, 5).forEach((alert) => {
        const severityColor =
          alert.severity === 'high' ? '#e74c3c' : alert.severity === 'medium' ? '#f39c12' : '#27ae60';
        doc.fillColor(severityColor).font('Helvetica-Bold').text(`${alert.title} [${alert.severity.toUpperCase()}]`, {
          moveDown: false,
        } as PdfTextOpts);
        doc.fillColor('#666666').font('Helvetica').text(alert.message, { moveDown: true } as PdfTextOpts);
        doc.fontSize(8).text(`${new Date(alert.createdAt).toLocaleDateString()}`, { moveDown: true } as PdfTextOpts);
        doc.fontSize(9).moveDown(0.1);
      });
    }

    // Suggested Actions
    if (report.suggestedActions.length > 0) {
      doc.moveDown(0.3);
      addSection('Suggested Actions');
      doc.fontSize(9).fillColor('#333333').font('Helvetica');

      report.suggestedActions.forEach((action) => {
        const priorityColor =
          action.priority === 'high' ? '#e74c3c' : action.priority === 'medium' ? '#f39c12' : '#95a5a6';
        doc.fillColor(priorityColor).font('Helvetica-Bold').text(`${action.title} [${action.priority.toUpperCase()}]`, {
          moveDown: false,
        } as PdfTextOpts);
        doc.fillColor('#666666').font('Helvetica').fontSize(8);
        doc.text(action.description, { width: 460, moveDown: true } as PdfTextOpts);
        doc.fontSize(9).text(`Action: ${action.action}`, { moveDown: true } as PdfTextOpts);
        doc.moveDown(0.1);
      });
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999999').text('Generated by ClientPulse | helloaurora.ai', {
      align: 'center',
    });

    doc.end();
  });
}

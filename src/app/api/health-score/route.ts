export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { FinancialSignalAgent } from '@/lib/agents/financial-signal-agent';
import { HealthScoringAgent, HealthScoreInput } from '@/lib/agents/health-scoring-agent';

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

    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Verify client ownership
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('agency_id', profile.agency_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Step 1: Get client's financial score from FinancialSignalAgent
    // For now, use mock data since we need to implement invoice fetching
    // In production, fetch actual invoices from Stripe
    const financialAgent = new FinancialSignalAgent();
    const mockInvoices: unknown[] = []; // TODO: Fetch actual invoices
    const financialHealthScore = await financialAgent.computeFinancialHealthScore(
      mockInvoices as Parameters<typeof financialAgent.computeFinancialHealthScore>[0]
    );
    const financialScore = financialHealthScore.score;

    // Step 2: Get client's meetings + intelligence data
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(
        `
        id,
        meeting_date,
        meeting_intelligence (
          sentiment_score,
          escalation_signals
        )
      `
      )
      .eq('client_id', clientId)
      .order('meeting_date', { ascending: false });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
    }

    // Extract sentiment scores from meetings (array of 1-10 values)
    const meetingSentimentScores: number[] = [];
    let lastMeetingDaysAgo = 999;

    interface MeetingRow {
      id: string;
      meeting_date: string;
      meeting_intelligence: Array<{ sentiment_score: number | null }> | null;
    }

    if (meetings && meetings.length > 0) {
      const typedMeetings = meetings as unknown as MeetingRow[];
      for (const meeting of typedMeetings) {
        if (meeting.meeting_intelligence && meeting.meeting_intelligence.length > 0) {
          const score = meeting.meeting_intelligence[0].sentiment_score;
          if (score !== null) {
            meetingSentimentScores.push(score);
          }
        }
      }
      // Calculate days since last meeting
      const lastMeetingDate = new Date(typedMeetings[0].meeting_date);
      lastMeetingDaysAgo = Math.floor((Date.now() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Determine meeting frequency trend
    let meetingFrequencyTrend: 'increasing' | 'stable' | 'declining' = 'stable';
    if (meetings && meetings.length >= 4) {
      const midpoint = Math.floor(meetings.length / 2);
      const recentCount = midpoint;
      const olderCount = meetings.length - midpoint;
      if (recentCount > olderCount * 1.3) meetingFrequencyTrend = 'increasing';
      else if (recentCount < olderCount * 0.7) meetingFrequencyTrend = 'declining';
    }

    // Step 3: Get action item stats
    const { data: actionItems, error: actionItemsError } = await supabase
      .from('action_items')
      .select('id, status')
      .eq('client_id', clientId);

    if (actionItemsError) {
      console.error('Error fetching action items:', actionItemsError);
    }

    const actionItemStats = {
      total: actionItems?.length ?? 0,
      completed: actionItems?.filter((a) => a.status === 'done').length ?? 0,
      overdue: actionItems?.filter((a) => a.status === 'overdue').length ?? 0,
    };

    // Step 4: Compute health score using HealthScoringAgent
    const healthScoringAgent = new HealthScoringAgent();
    const scoreInput: HealthScoreInput = {
      financialScore,
      meetingSentimentScores,
      actionItemStats,
      meetingFrequencyTrend,
      lastMeetingDaysAgo,
    };

    const healthScore = healthScoringAgent.computeHealthScore(scoreInput);

    // Step 5: Insert scores into health_score_history
    const { error: historyError } = await supabase
      .from('health_score_history')
      .insert({
        client_id: clientId,
        score: healthScore.overall,
        score_type: 'overall',
        recorded_at: new Date().toISOString(),
      });

    if (historyError) {
      console.error('Error inserting health score history:', historyError);
    }

    // Also insert sub-scores
    const subScoreEntries = [
      { score: healthScore.breakdown.financial, score_type: 'financial' },
      { score: healthScore.breakdown.relationship, score_type: 'relationship' },
      { score: healthScore.breakdown.delivery, score_type: 'delivery' },
      { score: healthScore.breakdown.engagement, score_type: 'engagement' },
    ].map(entry => ({
      client_id: clientId,
      ...entry,
      recorded_at: new Date().toISOString(),
    }));

    await supabase.from('health_score_history').insert(subScoreEntries);

    // Step 6: Update client_health_scores table
    const { error: upsertError } = await supabase
      .from('client_health_scores')
      .upsert({
        client_id: clientId,
        overall_score: healthScore.overall,
        financial_score: healthScore.breakdown.financial,
        relationship_score: healthScore.breakdown.relationship,
        delivery_score: healthScore.breakdown.delivery,
        engagement_score: healthScore.breakdown.engagement,
        status: healthScore.status,
        signals: healthScore.signals,
        explanation: healthScore.explanation,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('Error upserting client health score:', upsertError);
    }

    // Step 7: Return the computed score
    return NextResponse.json({
      success: true,
      clientId,
      score: healthScore.overall,
      status: healthScore.status,
      breakdown: healthScore.breakdown,
      signals: healthScore.signals,
      explanation: healthScore.explanation,
    });
  } catch (error) {
    console.error('Error computing health score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

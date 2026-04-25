export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { EngagementScoringAgent } from '@/lib/agents/engagement-scoring-agent';
import { computeCalendarMetrics } from '@/lib/agents/calendar-intelligence-agent';
import { computeEmailMetrics } from '@/lib/agents/email-intelligence-agent';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * POST /api/engagement
 * Recompute engagement score for a client using all available data sources
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

    // Verify client ownership
    const { data: client } = await supabase
      .from('clients')
      .select('id, agency_id')
      .eq('id', clientId)
      .eq('agency_id', agencyId)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Gather calendar data
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('id, client_id, start_time, end_time, attendees, status, is_recurring')
      .eq('agency_id', agencyId)
      .eq('client_id', clientId);

    let calendarMetrics = undefined;
    if (calendarEvents && calendarEvents.length > 0) {
      calendarMetrics = computeCalendarMetrics(
        clientId,
        calendarEvents as Array<{
          id: string;
          client_id: string | null;
          start_time: string;
          end_time: string;
          attendees: Array<{ email: string; name?: string; responseStatus: string; organizer?: boolean }>;
          status: string;
          is_recurring: boolean;
        }>
      );
    }

    // Gather email data
    const { data: emailThreads } = await supabase
      .from('email_threads')
      .select('id, client_id, last_message_date, message_count, participants, is_inbound, synced_at')
      .eq('agency_id', agencyId)
      .eq('client_id', clientId);

    let emailMetrics = undefined;
    if (emailThreads && emailThreads.length > 0) {
      emailMetrics = computeEmailMetrics(
        clientId,
        emailThreads as Array<{
          id: string;
          client_id: string | null;
          last_message_date: string;
          message_count: number;
          participants: string[];
          is_inbound: boolean;
          synced_at: string;
        }>
      );
    }

    // Fallback: get meeting data from existing meetings table (pre-calendar integration)
    let meetingFrequencyTrend: 'increasing' | 'stable' | 'declining' | undefined;
    let lastMeetingDaysAgo: number | undefined;

    if (!calendarMetrics) {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, meeting_date')
        .eq('client_id', clientId)
        .order('meeting_date', { ascending: false });

      if (meetings && meetings.length > 0) {
        lastMeetingDaysAgo = Math.floor(
          (Date.now() - new Date(meetings[0].meeting_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        // Simple trend from meeting count
        if (meetings.length >= 4) {
          const midpoint = Math.floor(meetings.length / 2);
          const recentCount = midpoint;
          const olderCount = meetings.length - midpoint;
          if (recentCount > olderCount * 1.3) meetingFrequencyTrend = 'increasing';
          else if (recentCount < olderCount * 0.7) meetingFrequencyTrend = 'declining';
          else meetingFrequencyTrend = 'stable';
        }
      }
    }

    // Compute engagement score
    const agent = new EngagementScoringAgent();
    const metrics = agent.computeEngagementScore(clientId, agencyId, {
      calendarMetrics,
      emailMetrics,
      meetingFrequencyTrend,
      lastMeetingDaysAgo,
    });

    // Upsert to DB
    const { error: upsertError } = await supabase
      .from('engagement_metrics')
      .upsert(
        {
          agency_id: agencyId,
          client_id: clientId,
          calendar_score: metrics.calendarScore,
          meeting_frequency: metrics.meetingFrequency,
          meeting_frequency_trend: metrics.meetingFrequencyTrend,
          last_meeting_days_ago: metrics.lastMeetingDaysAgo,
          next_meeting_days_away: metrics.nextMeetingDaysAway || null,
          attendee_engagement: metrics.attendeeEngagement,
          cadence_regularity: metrics.cadenceRegularity,
          email_score: metrics.emailScore,
          email_volume_trend: metrics.emailVolumeTrend,
          avg_response_time_hours: metrics.avgResponseTimeHours,
          client_responsiveness: metrics.clientResponsiveness,
          overall_engagement_score: metrics.overallEngagementScore,
          computed_at: metrics.computedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id,client_id' }
      );

    if (upsertError) {
      console.error('Error upserting engagement metrics:', upsertError);
    }

    return NextResponse.json({
      success: true,
      clientId,
      engagement: metrics,
    });
  } catch (error) {
    console.error('Engagement computation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/engagement?clientId=<id>
 * Get stored engagement metrics for a client
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    const clientId = request.nextUrl.searchParams.get('clientId');

    if (clientId) {
      // Single client
      const { data, error } = await supabase
        .from('engagement_metrics')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .single();

      if (error || !data) {
        return NextResponse.json({ engagement: null });
      }
      return NextResponse.json({ engagement: data });
    } else {
      // All clients
      const { data, error } = await supabase
        .from('engagement_metrics')
        .select('*')
        .eq('agency_id', agencyId)
        .order('overall_engagement_score', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
      }
      return NextResponse.json({ engagements: data || [] });
    }
  } catch (error) {
    console.error('Error fetching engagement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

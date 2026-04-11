export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGoogleCalendarEvents,
  matchEventsToClients,
  computeCalendarMetrics,
  refreshCalendarToken,
} from '@/lib/agents/calendar-intelligence-agent';

/**
 * POST /api/integrations/calendar/sync
 * Trigger a calendar sync: fetch events from Google, match to clients, compute metrics
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (!profile?.agency_id) {
      return NextResponse.json({ error: 'No agency found' }, { status: 404 });
    }

    // Get calendar connection
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('agency_id', profile.agency_id)
      .eq('provider', 'google_calendar')
      .eq('status', 'connected')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active Google Calendar connection found' },
        { status: 404 }
      );
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      try {
        const refreshed = await refreshCalendarToken(
          connection.refresh_token!,
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!
        );
        accessToken = refreshed.access_token;

        // Update stored token
        await supabase
          .from('integration_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(
              Date.now() + refreshed.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        await supabase
          .from('integration_connections')
          .update({ status: 'expired', error: 'Token refresh failed' })
          .eq('id', connection.id);
        return NextResponse.json({ error: 'Calendar connection expired, please reconnect' }, { status: 401 });
      }
    }

    // Fetch events (last 90 days + next 30 days)
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const googleEvents = await fetchGoogleCalendarEvents(accessToken!, timeMin, timeMax);

    // Get agency clients for matching
    const { data: clients } = await supabase
      .from('clients')
      .select('id, contact_email, company')
      .eq('agency_id', profile.agency_id);

    if (!clients || clients.length === 0) {
      return NextResponse.json({ eventsFound: googleEvents.length, clientsMatched: 0, message: 'No clients to match against' });
    }

    // Match events to clients
    const eventClientMap = matchEventsToClients(
      googleEvents.map((e) => ({
        id: e.id,
        attendees: (e.attendees || []).map((a) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus,
        })),
      })),
      clients
    );

    // Upsert calendar events into DB
    let eventsCreated = 0;
    const eventsUpdated = 0;

    for (const gEvent of googleEvents) {
      const clientId = eventClientMap.get(gEvent.id) || null;
      const startTime =
        gEvent.start.dateTime || (gEvent.start.date ? `${gEvent.start.date}T00:00:00Z` : null);
      const endTime =
        gEvent.end.dateTime || (gEvent.end.date ? `${gEvent.end.date}T23:59:59Z` : null);

      if (!startTime || !endTime) continue;

      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(
          {
            agency_id: profile.agency_id,
            client_id: clientId,
            connection_id: connection.id,
            google_event_id: gEvent.id,
            title: gEvent.summary || 'Untitled Event',
            description: gEvent.description || null,
            start_time: startTime,
            end_time: endTime,
            attendees: (gEvent.attendees || []).map((a) => ({
              email: a.email,
              name: a.displayName || null,
              responseStatus: a.responseStatus,
              organizer: a.organizer || false,
            })),
            status: gEvent.status === 'cancelled' ? 'cancelled' : gEvent.status === 'tentative' ? 'tentative' : 'confirmed',
            meeting_link: gEvent.hangoutLink || null,
            is_recurring: !!gEvent.recurringEventId,
            recurring_event_id: gEvent.recurringEventId || null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'connection_id,google_event_id' }
        );

      if (!upsertError) {
        eventsCreated++;
      }
    }

    // Compute engagement metrics per matched client
    const matchedClientIds = new Set(eventClientMap.values());

    // Fetch all calendar events for these clients to compute metrics
    const { data: allCalendarEvents } = await supabase
      .from('calendar_events')
      .select('id, client_id, start_time, end_time, attendees, status, is_recurring')
      .eq('agency_id', profile.agency_id)
      .not('client_id', 'is', null);

    for (const clientId of Array.from(matchedClientIds)) {
      if (!allCalendarEvents) continue;
      const metrics = computeCalendarMetrics(clientId, allCalendarEvents as Array<{
        id: string;
        client_id: string | null;
        start_time: string;
        end_time: string;
        attendees: Array<{ email: string; name?: string; responseStatus: string; organizer?: boolean }>;
        status: string;
        is_recurring: boolean;
      }>);

      // Upsert engagement_metrics
      await supabase
        .from('engagement_metrics')
        .upsert(
          {
            agency_id: profile.agency_id,
            client_id: clientId,
            calendar_score: metrics.cadenceScore,
            meeting_frequency: metrics.avgMeetingsPerWeek,
            meeting_frequency_trend: metrics.meetingFrequencyTrend,
            last_meeting_days_ago: metrics.lastMeetingDate
              ? Math.floor(
                  (Date.now() - new Date(metrics.lastMeetingDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 999,
            next_meeting_days_away: metrics.nextScheduledMeeting
              ? Math.max(
                  0,
                  Math.floor(
                    (new Date(metrics.nextScheduledMeeting).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              : null,
            attendee_engagement: metrics.attendeeEngagement,
            cadence_regularity: metrics.cadenceScore,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id,client_id' }
        );
    }

    // Update last sync time
    await supabase
      .from('integration_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return NextResponse.json({
      success: true,
      eventsFound: googleEvents.length,
      eventsCreated,
      eventsUpdated,
      clientsMatched: matchedClientIds.size,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

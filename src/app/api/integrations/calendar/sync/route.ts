export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { encryptToken, decryptToken } from '@/lib/crypto/integration-tokens';
import {
  fetchGoogleCalendarEvents,
  matchEventsToClients,
  computeCalendarMetrics,
  refreshCalendarToken,
} from '@/lib/agents/calendar-intelligence-agent';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * POST /api/integrations/calendar/sync
 * Trigger a calendar sync: fetch events from Google, match to clients, compute metrics.
 * Auth + writes via service client to avoid RLS-context drift (see /api/slack/route.ts).
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    // Get calendar connection
    const { data: connection } = await serviceClient
      .from('integration_connections')
      .select('*')
      .eq('agency_id', agencyId)
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
    let accessToken = connection.access_token ? decryptToken(connection.access_token) : null;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      try {
        const refreshed = await refreshCalendarToken(
          decryptToken(connection.refresh_token!),
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!
        );
        accessToken = refreshed.access_token;

        // Update stored token
        await serviceClient
          .from('integration_connections')
          .update({
            access_token: encryptToken(refreshed.access_token),
            token_expires_at: new Date(
              Date.now() + refreshed.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        await serviceClient
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
    const { data: clients } = await serviceClient
      .from('clients')
      .select('id, contact_email, company:company_name')
      .eq('agency_id', agencyId);

    if (!clients || clients.length === 0) {
      // No clients to match against — record that the sync ran successfully
      // anyway so the UI doesn't keep showing "Last sync: Never". Without
      // this the user would think Sync Now was broken every time they hit
      // it on an empty-roster account.
      await serviceClient
        .from('integration_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
      return NextResponse.json({
        success: true,
        eventsFound: googleEvents.length,
        clientsMatched: 0,
        message: 'Sync ran — no clients to match against. Add a client first to surface engagement.',
      });
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

      const { error: upsertError } = await serviceClient
        .from('calendar_events')
        .upsert(
          {
            agency_id: agencyId,
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
    const { data: allCalendarEvents } = await serviceClient
      .from('calendar_events')
      .select('id, client_id, start_time, end_time, attendees, status, is_recurring')
      .eq('agency_id', agencyId)
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
      await serviceClient
        .from('engagement_metrics')
        .upsert(
          {
            agency_id: agencyId,
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
    await serviceClient
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

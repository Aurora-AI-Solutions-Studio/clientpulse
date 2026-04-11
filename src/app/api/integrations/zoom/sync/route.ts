export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchZoomMeetings,
  fetchZoomRecordings,
  fetchMeetingParticipants,
  matchMeetingsToClients,
  refreshZoomToken,
} from '@/lib/agents/zoom-intelligence-agent';

/**
 * POST /api/integrations/zoom/sync
 * Sync Zoom meetings + recordings: fetch from Zoom API, match to clients, store metadata
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

    // Get Zoom connection
    const { data: connection } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('agency_id', profile.agency_id)
      .eq('provider', 'zoom')
      .eq('status', 'connected')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active Zoom connection found' },
        { status: 404 }
      );
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      try {
        const refreshed = await refreshZoomToken(
          connection.refresh_token!,
          process.env.ZOOM_CLIENT_ID!,
          process.env.ZOOM_CLIENT_SECRET!
        );
        accessToken = refreshed.access_token;

        // Zoom rotates refresh tokens — store the new one
        await supabase
          .from('integration_connections')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            token_expires_at: new Date(
              Date.now() + refreshed.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);
      } catch (refreshError) {
        console.error('Zoom token refresh failed:', refreshError);
        await supabase
          .from('integration_connections')
          .update({ status: 'expired', error: 'Token refresh failed' })
          .eq('id', connection.id);
        return NextResponse.json(
          { error: 'Zoom connection expired, please reconnect' },
          { status: 401 }
        );
      }
    }

    // Fetch meetings + recordings (last 90 days)
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    const [meetings, recordings] = await Promise.all([
      fetchZoomMeetings(accessToken!, fromDate, toDate),
      fetchZoomRecordings(accessToken!, fromDate, toDate),
    ]);

    // Build recording lookup: meetingId → recording info
    const recordingMap = new Map<number, { shareUrl?: string; hasTranscript: boolean; totalSize: number }>();
    for (const rec of recordings) {
      const hasTranscript = (rec.recording_files || []).some(
        (f) => f.file_type === 'TRANSCRIPT'
      );
      recordingMap.set(rec.id, {
        shareUrl: rec.share_url,
        hasTranscript,
        totalSize: rec.total_size || 0,
      });
    }

    // Get agency clients for matching
    const { data: clients } = await supabase
      .from('clients')
      .select('id, contact_email, company')
      .eq('agency_id', profile.agency_id);

    // Fetch participants for each meeting (rate-limited: max 30 to avoid throttling)
    const meetingsWithParticipants: Array<{
      uuid: string;
      participants: Array<{ user_email: string; name: string; join_time: string; leave_time: string; duration: number }>;
    }> = [];

    const meetingsToFetchParticipants = meetings.slice(0, 30);
    for (const meeting of meetingsToFetchParticipants) {
      const participants = await fetchMeetingParticipants(accessToken!, meeting.uuid);
      meetingsWithParticipants.push({
        uuid: meeting.uuid,
        participants,
      });
    }

    // Match meetings to clients
    const meetingClientMap =
      clients && clients.length > 0
        ? matchMeetingsToClients(meetingsWithParticipants, clients)
        : new Map<string, string>();

    // Upsert zoom meetings into DB
    let meetingsCreated = 0;

    for (const meeting of meetings) {
      const clientId = meetingClientMap.get(meeting.uuid) || null;
      const rec = recordingMap.get(meeting.id);
      const startTime = meeting.start_time;

      if (!startTime) continue;

      const participants = meetingsWithParticipants.find((m) => m.uuid === meeting.uuid)?.participants || [];

      const { error: upsertError } = await supabase
        .from('zoom_meetings')
        .upsert(
          {
            agency_id: profile.agency_id,
            client_id: clientId,
            connection_id: connection.id,
            zoom_meeting_id: String(meeting.id),
            zoom_uuid: meeting.uuid,
            topic: meeting.topic || 'Untitled Meeting',
            start_time: startTime,
            duration_minutes: meeting.duration || 0,
            meeting_type: meeting.type,
            join_url: meeting.join_url || null,
            participants: participants.map((p) => ({
              email: p.user_email || null,
              name: p.name || null,
              duration_seconds: p.duration || 0,
            })),
            participant_count: participants.length,
            has_recording: !!rec,
            recording_share_url: rec?.shareUrl || null,
            has_transcript: rec?.hasTranscript || false,
            recording_size_bytes: rec?.totalSize || 0,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'connection_id,zoom_meeting_id' }
        );

      if (!upsertError) {
        meetingsCreated++;
      }
    }

    // Update engagement metrics for matched clients
    const matchedClientIds = new Set(
      Array.from(meetingClientMap.values())
    );

    // Fetch all zoom meetings for engagement computation
    const { data: allZoomMeetings } = await supabase
      .from('zoom_meetings')
      .select('client_id, start_time, duration_minutes, has_recording')
      .eq('agency_id', profile.agency_id)
      .not('client_id', 'is', null);

    for (const clientId of Array.from(matchedClientIds)) {
      if (!allZoomMeetings) continue;

      const clientMeetings = allZoomMeetings.filter((m) => m.client_id === clientId);
      const now = Date.now();
      const d30 = now - 30 * 24 * 60 * 60 * 1000;

      const last30d = clientMeetings.filter(
        (m) => new Date(m.start_time).getTime() >= d30
      );

      // Update engagement_metrics with Zoom data
      // We add Zoom meetings to the calendar_score as supplementary meeting signal
      const { data: existing } = await supabase
        .from('engagement_metrics')
        .select('calendar_score, meeting_frequency')
        .eq('agency_id', profile.agency_id)
        .eq('client_id', clientId)
        .single();

      const zoomMeetingsPerWeek = last30d.length / 4.3;
      const combinedFrequency = (existing?.meeting_frequency || 0) + zoomMeetingsPerWeek;

      await supabase
        .from('engagement_metrics')
        .upsert(
          {
            agency_id: profile.agency_id,
            client_id: clientId,
            // Boost calendar_score with Zoom meeting data (cap at 100)
            calendar_score: Math.min(100, (existing?.calendar_score || 0) + Math.min(30, last30d.length * 10)),
            meeting_frequency: combinedFrequency,
            last_meeting_days_ago: clientMeetings.length > 0
              ? Math.floor(
                  (Date.now() -
                    new Date(
                      clientMeetings.sort(
                        (a, b) =>
                          new Date(b.start_time).getTime() -
                          new Date(a.start_time).getTime()
                      )[0].start_time
                    ).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 999,
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
      meetingsFound: meetings.length,
      recordingsFound: recordings.length,
      meetingsCreated,
      clientsMatched: matchedClientIds.size,
    });
  } catch (error) {
    console.error('Zoom sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

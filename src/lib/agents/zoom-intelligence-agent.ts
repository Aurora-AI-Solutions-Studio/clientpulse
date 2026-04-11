/**
 * Zoom Intelligence Agent — Sprint 5 Task 5.3
 *
 * Handles Zoom OAuth2 flow, meeting/recording sync, and client matching.
 * Pattern mirrors calendar-intelligence-agent.ts and email-intelligence-agent.ts.
 *
 * Scopes required: meeting:read:list_meetings, cloud_recording:read:list_recording_files,
 *                  cloud_recording:read:recording_file, user:read:user
 */

// ─── OAuth Helpers ──────────────────────────────────────────────────

const ZOOM_AUTH_BASE = 'https://zoom.us/oauth';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

/**
 * Build the Zoom OAuth2 authorization URL
 */
export function buildZoomAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${ZOOM_AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens
 */
export async function exchangeZoomCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const res = await fetch(`${ZOOM_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Zoom token exchange failed (${res.status}): ${errBody}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshZoomToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${ZOOM_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Zoom token refresh failed (${res.status}): ${errBody}`);
  }

  return res.json();
}

// ─── Zoom API Helpers ───────────────────────────────────────────────

export interface ZoomUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  type: number; // 1=instant, 2=scheduled, 3=recurring no fixed, 8=recurring fixed
  start_time: string;
  duration: number; // minutes
  timezone: string;
  join_url: string;
  status: string;
}

export interface ZoomRecording {
  uuid: string;
  id: number;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  share_url?: string;
  recording_files: ZoomRecordingFile[];
  participant_audio_files?: ZoomRecordingFile[];
}

export interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string; // MP4, M4A, TRANSCRIPT, CHAT, etc.
  file_size: number;
  download_url: string;
  status: string;
  recording_type: string;
}

export interface ZoomMeetingParticipant {
  id?: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number; // seconds
}

/**
 * Get the authenticated Zoom user's profile
 */
export async function getZoomUserInfo(accessToken: string): Promise<ZoomUserInfo> {
  const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Zoom user info failed (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch past meetings for the authenticated user (last N days)
 */
export async function fetchZoomMeetings(
  accessToken: string,
  fromDate: string,
  toDate: string
): Promise<ZoomMeeting[]> {
  const allMeetings: ZoomMeeting[] = [];
  let nextPageToken = '';

  do {
    const params = new URLSearchParams({
      type: 'past',
      from: fromDate.split('T')[0], // YYYY-MM-DD
      to: toDate.split('T')[0],
      page_size: '100',
    });
    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const res = await fetch(`${ZOOM_API_BASE}/users/me/meetings?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Zoom meetings fetch failed (${res.status}):`, errBody);
      break;
    }

    const data = await res.json();
    allMeetings.push(...(data.meetings || []));
    nextPageToken = data.next_page_token || '';
  } while (nextPageToken);

  return allMeetings;
}

/**
 * Fetch cloud recordings for the authenticated user
 */
export async function fetchZoomRecordings(
  accessToken: string,
  fromDate: string,
  toDate: string
): Promise<ZoomRecording[]> {
  const allRecordings: ZoomRecording[] = [];
  let nextPageToken = '';

  do {
    const params = new URLSearchParams({
      from: fromDate.split('T')[0],
      to: toDate.split('T')[0],
      page_size: '100',
    });
    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const res = await fetch(
      `${ZOOM_API_BASE}/users/me/recordings?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Zoom recordings fetch failed (${res.status}):`, errBody);
      break;
    }

    const data = await res.json();
    allRecordings.push(...(data.meetings || []));
    nextPageToken = data.next_page_token || '';
  } while (nextPageToken);

  return allRecordings;
}

/**
 * Fetch participants for a specific past meeting
 */
export async function fetchMeetingParticipants(
  accessToken: string,
  meetingUuid: string
): Promise<ZoomMeetingParticipant[]> {
  // Double-encode UUIDs that start with / or contain //
  const encodedUuid =
    meetingUuid.startsWith('/') || meetingUuid.includes('//')
      ? encodeURIComponent(encodeURIComponent(meetingUuid))
      : meetingUuid;

  const res = await fetch(
    `${ZOOM_API_BASE}/past_meetings/${encodedUuid}/participants?page_size=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    // 404 = meeting too old or participants unavailable — not an error
    if (res.status === 404) return [];
    console.error(`Zoom participants fetch failed (${res.status})`);
    return [];
  }

  const data = await res.json();
  return data.participants || [];
}

// ─── Client Matching ────────────────────────────────────────────────

/**
 * Match Zoom meeting participants to agency clients by email domain + exact email
 * Same strategy as calendar-intelligence-agent.ts
 */
export function matchMeetingsToClients(
  meetings: Array<{
    uuid: string;
    participants: ZoomMeetingParticipant[];
  }>,
  clients: Array<{
    id: string;
    contact_email: string | null;
    company: string | null;
  }>
): Map<string, string> {
  const meetingClientMap = new Map<string, string>();

  // Build lookup: email → clientId, domain → clientId
  const emailToClient = new Map<string, string>();
  const domainToClient = new Map<string, string>();

  for (const client of clients) {
    if (client.contact_email) {
      const email = client.contact_email.toLowerCase().trim();
      emailToClient.set(email, client.id);
      const domain = email.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
        domainToClient.set(domain, client.id);
      }
    }
  }

  for (const meeting of meetings) {
    for (const participant of meeting.participants) {
      if (!participant.user_email) continue;
      const email = participant.user_email.toLowerCase().trim();

      // Exact email match
      const clientByEmail = emailToClient.get(email);
      if (clientByEmail) {
        meetingClientMap.set(meeting.uuid, clientByEmail);
        break;
      }

      // Domain match
      const domain = email.split('@')[1];
      if (domain) {
        const clientByDomain = domainToClient.get(domain);
        if (clientByDomain) {
          meetingClientMap.set(meeting.uuid, clientByDomain);
          break;
        }
      }
    }
  }

  return meetingClientMap;
}

// ─── Zoom Metrics Computation ───────────────────────────────────────

export interface ZoomMeetingMetrics {
  totalMeetings30d: number;
  totalMeetings90d: number;
  totalRecordingMinutes: number;
  avgMeetingDuration: number; // minutes
  meetingFrequencyTrend: 'increasing' | 'stable' | 'declining';
  hasRecordings: boolean;
  lastMeetingDate?: string;
}

/**
 * Compute per-client Zoom meeting metrics from synced data
 */
export function computeZoomMetrics(
  clientId: string,
  meetings: Array<{
    client_id: string | null;
    start_time: string;
    duration_minutes: number;
    has_recording: boolean;
  }>
): ZoomMeetingMetrics {
  const clientMeetings = meetings
    .filter((m) => m.client_id === clientId)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const now = Date.now();
  const d30 = now - 30 * 24 * 60 * 60 * 1000;
  const d60 = now - 60 * 24 * 60 * 60 * 1000;
  const d90 = now - 90 * 24 * 60 * 60 * 1000;

  const last30 = clientMeetings.filter((m) => new Date(m.start_time).getTime() >= d30);
  const mid30 = clientMeetings.filter(
    (m) => new Date(m.start_time).getTime() >= d60 && new Date(m.start_time).getTime() < d30
  );
  const last90 = clientMeetings.filter((m) => new Date(m.start_time).getTime() >= d90);

  // Frequency trend: compare last 30d vs previous 30d
  let trend: 'increasing' | 'stable' | 'declining' = 'stable';
  if (last30.length > mid30.length + 1) trend = 'increasing';
  else if (last30.length < mid30.length - 1) trend = 'declining';

  const totalDuration = last90.reduce((sum, m) => sum + m.duration_minutes, 0);
  const recordingMinutes = last90
    .filter((m) => m.has_recording)
    .reduce((sum, m) => sum + m.duration_minutes, 0);

  return {
    totalMeetings30d: last30.length,
    totalMeetings90d: last90.length,
    totalRecordingMinutes: recordingMinutes,
    avgMeetingDuration: last90.length > 0 ? Math.round(totalDuration / last90.length) : 0,
    meetingFrequencyTrend: trend,
    hasRecordings: last90.some((m) => m.has_recording),
    lastMeetingDate: clientMeetings[0]?.start_time || undefined,
  };
}

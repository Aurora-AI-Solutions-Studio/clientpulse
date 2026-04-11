/**
 * Calendar Intelligence Agent — Sprint 5
 *
 * Syncs Google Calendar events, matches them to clients via attendee emails,
 * and computes per-client calendar engagement metrics (frequency, cadence,
 * attendee engagement, trend).
 */

import { ClientCalendarMetrics } from '@/types/integrations';

interface CalendarEventRow {
  id: string;
  client_id: string | null;
  start_time: string;
  end_time: string;
  attendees: Array<{
    email: string;
    name?: string;
    responseStatus: string;
    organizer?: boolean;
  }>;
  status: string;
  is_recurring: boolean;
}

/**
 * Match calendar events to clients based on attendee email domains / contact emails
 */
export function matchEventsToClients(
  events: Array<{
    id: string;
    attendees: Array<{ email: string; name?: string; responseStatus: string }>;
    [key: string]: unknown;
  }>,
  clients: Array<{
    id: string;
    contact_email?: string;
    company: string;
  }>
): Map<string, string> {
  const eventToClient = new Map<string, string>();

  // Build lookup: email → client, domain → client
  const emailToClient = new Map<string, string>();
  const domainToClient = new Map<string, string>();

  for (const client of clients) {
    if (client.contact_email) {
      emailToClient.set(client.contact_email.toLowerCase(), client.id);
      const domain = client.contact_email.split('@')[1]?.toLowerCase();
      if (domain && !isGenericDomain(domain)) {
        domainToClient.set(domain, client.id);
      }
    }
  }

  for (const event of events) {
    if (!event.attendees || event.attendees.length === 0) continue;

    for (const attendee of event.attendees) {
      const email = attendee.email.toLowerCase();
      // Direct email match
      if (emailToClient.has(email)) {
        eventToClient.set(event.id as string, emailToClient.get(email)!);
        break;
      }
      // Domain match
      const domain = email.split('@')[1];
      if (domain && domainToClient.has(domain)) {
        eventToClient.set(event.id as string, domainToClient.get(domain)!);
        break;
      }
    }
  }

  return eventToClient;
}

/**
 * Compute calendar engagement metrics for a single client
 */
export function computeCalendarMetrics(
  clientId: string,
  events: CalendarEventRow[],
  now: Date = new Date()
): ClientCalendarMetrics {
  const clientEvents = events
    .filter((e) => e.client_id === clientId && e.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const msPerDay = 1000 * 60 * 60 * 24;
  const now30d = new Date(now.getTime() - 30 * msPerDay);
  const now60d = new Date(now.getTime() - 60 * msPerDay);
  const now90d = new Date(now.getTime() - 90 * msPerDay);

  const past = clientEvents.filter((e) => new Date(e.start_time) <= now);
  const future = clientEvents.filter((e) => new Date(e.start_time) > now);

  const meetings30d = past.filter((e) => new Date(e.start_time) >= now30d).length;
  const meetings60d = past.filter((e) => new Date(e.start_time) >= now60d).length;
  const meetings90d = past.filter((e) => new Date(e.start_time) >= now90d).length;

  // Frequency trend: compare last 30d vs prior 30d
  const prior30d = past.filter(
    (e) => new Date(e.start_time) >= now60d && new Date(e.start_time) < now30d
  ).length;

  let meetingFrequencyTrend: 'increasing' | 'stable' | 'declining' = 'stable';
  if (meetings30d > prior30d * 1.3) meetingFrequencyTrend = 'increasing';
  else if (meetings30d < prior30d * 0.7 && prior30d > 0) meetingFrequencyTrend = 'declining';

  // Average meetings per week (last 90 days)
  const avgMeetingsPerWeek = meetings90d > 0 ? meetings90d / (90 / 7) : 0;

  // Last meeting date
  const lastPastEvent = past[past.length - 1];
  const lastMeetingDate = lastPastEvent ? lastPastEvent.start_time : undefined;

  // Next scheduled meeting
  const nextFutureEvent = future[0];
  const nextScheduledMeeting = nextFutureEvent ? nextFutureEvent.start_time : undefined;

  // Attendee engagement: % of meetings where any non-organizer attendee accepted
  let attendeeEngagement = 50; // Default
  if (past.length > 0) {
    const meetingsWithAccepted = past.filter((e) => {
      if (!e.attendees || !Array.isArray(e.attendees)) return false;
      return e.attendees.some(
        (a) => !a.organizer && a.responseStatus === 'accepted'
      );
    }).length;
    attendeeEngagement = Math.round((meetingsWithAccepted / past.length) * 100);
  }

  // Cadence regularity: measure standard deviation of gaps between meetings
  let cadenceScore = 50; // Default
  if (past.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < past.length; i++) {
      const gap =
        (new Date(past[i].start_time).getTime() -
          new Date(past[i - 1].start_time).getTime()) /
        msPerDay;
      gaps.push(gap);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance =
      gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    // Lower stdDev relative to avgGap = more regular cadence
    const coefficientOfVariation = avgGap > 0 ? stdDev / avgGap : 1;
    cadenceScore = Math.round(Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100)));
  }

  return {
    clientId,
    totalMeetings30d: meetings30d,
    totalMeetings60d: meetings60d,
    totalMeetings90d: meetings90d,
    meetingFrequencyTrend,
    avgMeetingsPerWeek: Math.round(avgMeetingsPerWeek * 10) / 10,
    lastMeetingDate,
    nextScheduledMeeting,
    attendeeEngagement,
    cadenceScore,
  };
}

/**
 * Generic email domains that shouldn't be used for client matching
 */
function isGenericDomain(domain: string): boolean {
  const generic = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'googlemail.com',
  ]);
  return generic.has(domain);
}

/**
 * Build Google Calendar OAuth URL for authorization
 */
export function buildGoogleCalendarAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCalendarCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshCalendarToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google OAuth token refresh failed: ${error}`);
  }

  return response.json();
}

/**
 * Fetch calendar events from Google Calendar API
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  maxResults: number = 250
): Promise<Array<{
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
    organizer?: boolean;
  }>;
  status: string;
  htmlLink: string;
  hangoutLink?: string;
  recurringEventId?: string;
}>> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar API error: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

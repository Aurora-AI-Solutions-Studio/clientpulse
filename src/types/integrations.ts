/**
 * Sprint 5 — Integration types for Calendar, Email, and Connection management
 */

// ─── OAuth Connection Management ────────────────────────────────────

export type IntegrationProvider = 'google_calendar' | 'gmail' | 'zoom' | 'google_meet';

export interface IntegrationConnection {
  id: string;
  agencyId: string;
  userId: string;
  provider: IntegrationProvider;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes: string[];
  accountEmail?: string;
  accountName?: string;
  connectedAt: string;
  lastSyncAt?: string;
  error?: string;
}

export interface ConnectionCreateInput {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  scopes: string[];
  accountEmail: string;
  accountName?: string;
}

// ─── Google Calendar Types ──────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  agencyId: string;
  clientId: string;
  connectionId: string;
  googleEventId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: CalendarAttendee[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  meetingLink?: string;
  isRecurring: boolean;
  recurringEventId?: string;
  syncedAt: string;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
}

export interface CalendarSyncResult {
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  clientsMatched: number;
  errors: string[];
}

export interface ClientCalendarMetrics {
  clientId: string;
  totalMeetings30d: number;
  totalMeetings60d: number;
  totalMeetings90d: number;
  meetingFrequencyTrend: 'increasing' | 'stable' | 'declining';
  avgMeetingsPerWeek: number;
  lastMeetingDate?: string;
  nextScheduledMeeting?: string;
  attendeeEngagement: number; // 0-100: percentage of meetings where client decision-makers attended
  cadenceScore: number; // 0-100: regularity of meeting schedule
}

// ─── Gmail Integration Types ────────────────────────────────────────

export interface EmailThread {
  id: string;
  agencyId: string;
  clientId: string;
  connectionId: string;
  gmailThreadId: string;
  subject: string;
  lastMessageDate: string;
  messageCount: number;
  participants: string[];
  snippet?: string;
  isInbound: boolean;
  syncedAt: string;
}

export interface ClientEmailMetrics {
  clientId: string;
  totalThreads30d: number;
  totalMessages30d: number;
  avgResponseTimeHours: number; // Agency's avg response time to client
  clientAvgResponseTimeHours: number; // Client's avg response time to agency
  responseTimetrend: 'improving' | 'stable' | 'worsening';
  volumeTrend: 'increasing' | 'stable' | 'declining';
  lastEmailDate?: string;
  sentimentIndicator?: 'positive' | 'neutral' | 'negative';
}

// ─── Engagement Score Types ─────────────────────────────────────────

export interface EngagementMetrics {
  clientId: string;
  agencyId: string;
  // Calendar signals
  calendarScore: number; // 0-100
  meetingFrequency: number; // meetings per week
  meetingFrequencyTrend: 'increasing' | 'stable' | 'declining';
  lastMeetingDaysAgo: number;
  nextMeetingDaysAway?: number;
  attendeeEngagement: number; // 0-100
  cadenceRegularity: number; // 0-100
  // Email signals
  emailScore: number; // 0-100
  emailVolumeTrend: 'increasing' | 'stable' | 'declining';
  avgResponseTimeHours: number;
  clientResponsiveness: number; // 0-100
  // Combined
  overallEngagementScore: number; // 0-100 weighted composite
  computedAt: string;
}

export interface EngagementScoreInput {
  calendarMetrics?: ClientCalendarMetrics;
  emailMetrics?: ClientEmailMetrics;
  // Fallback data from existing meeting uploads (pre-calendar-integration)
  meetingFrequencyTrend?: 'increasing' | 'stable' | 'declining';
  lastMeetingDaysAgo?: number;
}

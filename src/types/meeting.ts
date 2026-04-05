/**
 * Meeting and related types for Sprint 2 - Meeting Intelligence
 */

export interface Meeting {
  id: string;
  clientId: string;
  agencyId: string;
  title: string;
  meetingDate: string;
  durationMinutes?: number;
  audioUrl?: string;
  transcript?: string;
  status: 'scheduled' | 'completed' | 'processing' | 'failed';
  createdAt: string;
}

export interface MeetingIntelligence {
  id: string;
  meetingId: string;
  sentimentScore: number;
  actionItems: ActionItemData[];
  scopeChanges: ScopeChangeData[];
  stakeholderEngagement: StakeholderEngagementData;
  escalationSignals: EscalationSignalData[];
  upsellMentions: UpsellMentionData[];
  summary: string;
  extractedAt: number;
}

export interface ActionItemData {
  title: string;
  assignee: string;
  deadline: string | null;
}

export interface ScopeChangeData {
  description: string;
  impact: string;
}

export interface StakeholderEngagementData {
  attendees: string[];
  decision_makers_present: boolean;
  engagement_level: 'high' | 'medium' | 'low';
}

export interface EscalationSignalData {
  signal: string;
  severity: 'high' | 'medium' | 'low';
}

export interface UpsellMentionData {
  mention: string;
  estimated_value: number | null;
  context: string;
}

export interface MeetingWithIntelligence extends Meeting {
  intelligence?: MeetingIntelligence;
}

export interface MeetingCreateInput {
  clientId: string;
  title: string;
  meetingDate: string;
  durationMinutes?: number;
}

export interface ActionItem {
  id: string;
  clientId: string;
  meetingId?: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'completed';
  dueDate?: string;
  assignedTo?: string;
  createdAt: string;
}

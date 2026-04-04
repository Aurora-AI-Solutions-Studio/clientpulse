export interface HealthBreakdown {
  financial: number; // 30%
  relationship: number; // 30%
  delivery: number; // 25%
  engagement: number; // 15%
}

export interface HealthScore {
  overall: number; // 0-100
  breakdown: HealthBreakdown;
  lastUpdated: string;
  status: 'healthy' | 'at-risk' | 'critical';
}

export interface ClientSignal {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  date: string;
}

export interface ClientMeeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  contactEmail?: string;
  monthlyRetainer?: number;
  serviceType?: string;
  healthScore: HealthScore;
  status: string;
  lastMeetingDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  agencyId: string;
}

export interface ClientCreateInput {
  name: string;
  company: string;
  contactEmail: string;
  monthlyRetainer: number;
  serviceType: string;
  notes?: string;
}

export interface ClientUpdateInput {
  name?: string;
  company?: string;
  contactEmail?: string;
  monthlyRetainer?: number;
  serviceType?: 'Content' | 'SEO' | 'Paid Media' | 'Social' | 'Design' | 'PR' | 'Full Service';
  notes?: string;
  status?: 'active' | 'paused' | 'churned';
  lastMeetingDate?: string;
}

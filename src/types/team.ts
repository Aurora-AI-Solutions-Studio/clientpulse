/**
 * Team & Agency types for Sprint 6 - Team Features
 */

export interface AgencyMember {
  id: string;
  userId: string;
  agencyId: string;
  role: 'owner' | 'manager' | 'viewer';
  email: string;
  fullName: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface TeamInvitation {
  id: string;
  agencyId: string;
  invitedBy: string;
  invitedByName?: string;
  email: string;
  role: 'owner' | 'manager' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface ClientAssignment {
  id: string;
  clientId: string;
  clientName: string;
  userId: string;
  userName: string;
  agencyId: string;
  role: 'account_manager' | 'support' | 'lead';
  assignedAt: string;
}

export interface TeamDashboardData {
  totalMembers: number;
  totalClients: number;
  members: TeamMemberSummary[];
  unassignedClients: number;
}

export interface TeamMemberSummary {
  userId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'viewer';
  assignedClients: number;
  healthyClients: number;
  atRiskClients: number;
  criticalClients: number;
  avgHealthScore: number;
}

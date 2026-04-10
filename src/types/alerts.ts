/**
 * Alert system types for Sprint 4 - Alerts, Churn Prediction, and Upsell Detection
 */

/**
 * Alert types for different client situations
 */
export interface Alert {
  id: string;
  agencyId: string;
  clientId: string;
  clientName: string;
  type: 'churn_risk' | 'health_drop' | 'upsell_opportunity' | 'action_required';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

/**
 * Item in the approval queue for user actions
 */
export interface ApprovalItem {
  id: string;
  agencyId: string;
  clientId: string;
  clientName: string;
  type: 'monday_brief' | 'churn_alert' | 'save_plan' | 'check_in_invite';
  status: 'pending' | 'approved' | 'dismissed' | 'auto_approved';
  title: string;
  description: string;
  content: Record<string, unknown>; // The actual payload (email body, calendar invite, etc.)
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  autoApproveEnabled: boolean;
}

/**
 * Churn prediction for a client
 */
export interface ChurnPrediction {
  clientId: string;
  clientName: string;
  churnProbability: number; // 0-100
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  drivingFactors: ChurnFactor[];
  suggestedActions: SuggestedAction[];
  savePlan?: SavePlan;
  computedAt: string;
}

/**
 * A factor contributing to churn probability
 */
export interface ChurnFactor {
  category: 'financial' | 'relationship' | 'delivery' | 'engagement';
  signal: string;
  impact: number; // negative number, how much it contributes to churn risk
  details: string;
}

/**
 * A suggested action to prevent churn
 */
export interface SuggestedAction {
  id: string;
  priority: 'immediate' | 'this_week' | 'this_month';
  action: string;
  rationale: string;
  type: 'qbr' | 'check_in' | 'invoice_followup' | 'stakeholder_reengagement' | 'service_review' | 'escalation';
}

/**
 * A save plan with suggested actions to prevent churn
 */
export interface SavePlan {
  id: string;
  clientId: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'executed' | 'dismissed';
  checkInEmail: { subject: string; body: string };
  qbrAgenda: string[];
  talkingPoints: string[];
  createdAt: string;
}

/**
 * Upsell opportunity detected for a client
 */
export interface UpsellOpportunity {
  id: string;
  clientId: string;
  clientName: string;
  signal: string;
  context: string;
  currentServices: string;
  suggestedService: string;
  estimatedValue: number | null;
  confidence: 'high' | 'medium' | 'low';
  sourceType: 'meeting_transcript' | 'usage_pattern' | 'market_signal';
  sourceMeetingId?: string;
  detectedAt: string;
}

/**
 * User preferences for alerts and approvals
 */
export interface AlertPreferences {
  userId: string;
  healthThreshold: number; // default 60
  churnAlertThreshold: number; // default 60
  autoApproveTypes: string[]; // e.g., ['monday_brief']
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

/**
 * Stripe-related TypeScript types for ClientPulse
 */

export type SubscriptionPlan = 'starter' | 'pro' | 'agency';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing';

export interface StripeInvoiceData {
  id: string;
  invoiceNumber?: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  dueDate?: number;
  paidDate?: number;
  createdAt: number;
  description?: string;
  metadata?: Record<string, unknown>;
  paymentIntentStatus?: string;
  attemptedPayments?: number;
}

export interface DisputeSignal {
  type: 'dispute' | 'failed_payment' | 'late_payment';
  severity: 'low' | 'medium' | 'high';
  invoiceId: string;
  message: string;
  detectedAt: number;
}

export interface TrendSignal {
  direction: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
  confidence: number; // 0-1
  message: string;
}

export interface FinancialHealthScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  subScores: {
    paymentTimeliness: number; // 0-100
    invoiceDisputes: number; // 0-100 (inverted, high is good)
    revenueTrend: number; // 0-100
    concentrationRisk: number; // 0-100 (inverted, high is good)
  };
  signals: DisputeSignal[];
  trendSignal?: TrendSignal;
  explanation: string;
  lastUpdated: number;
}

export interface ClientRevenue {
  clientId: string;
  totalRevenue: number;
  invoiceCount: number;
  avgInvoiceAmount: number;
}

export interface SubscriptionInfo {
  id: string;
  customerId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  canceledAt?: number;
  cancelAtPeriodEnd: boolean;
  trialEnd?: number;
  metadata?: Record<string, unknown>;
}

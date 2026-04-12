/**
 * Recursive Learning types for Sprint 6
 */

export interface ClientOutcome {
  id: string;
  clientId: string;
  clientName?: string;
  agencyId: string;
  outcomeType: 'renewed' | 'churned' | 'expanded' | 'downgraded' | 'paused';
  outcomeDate: string;
  previousRetainer?: number;
  newRetainer?: number;
  reason?: string;
  notes?: string;
  healthScoreAtOutcome?: number;
  churnPredictionAtOutcome?: number;
  healthBreakdownAtOutcome?: {
    financial: number;
    relationship: number;
    delivery: number;
    engagement: number;
  };
  recordedBy?: string;
  createdAt: string;
}

export interface PredictionFeedback {
  id: string;
  clientId: string;
  agencyId: string;
  predictionId?: string;
  predictedChurnProbability: number;
  predictedRiskLevel: string;
  actualOutcome: string;
  predictionCorrect: boolean;
  daysBetweenPredictionAndOutcome?: number;
  drivingFactors?: Record<string, unknown>;
  outcomeId?: string;
  createdAt: string;
}

export interface LearningSnapshot {
  id: string;
  agencyId: string;
  snapshotDate: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracyRate: number;
  totalOutcomes: number;
  signalWeights: SignalWeights;
  recommendedWeights?: SignalWeights;
  topPredictiveSignals?: PredictiveSignal[];
  falsePositiveRate?: number;
  falseNegativeRate?: number;
  createdAt: string;
}

export interface SignalWeights {
  financial: number;
  relationship: number;
  delivery: number;
  engagement: number;
}

export interface PredictiveSignal {
  signal: string;
  category: 'financial' | 'relationship' | 'delivery' | 'engagement';
  correlation: number; // -1 to 1, how strongly it correlates with churn
  occurrences: number;
}

export interface LearningDashboardData {
  currentAccuracy: number;
  totalOutcomes: number;
  totalPredictions: number;
  accuracyTrend: { date: string; accuracy: number }[];
  signalEffectiveness: {
    category: string;
    currentWeight: number;
    recommendedWeight: number;
    correlation: number;
  }[];
  recentOutcomes: ClientOutcome[];
  predictionBreakdown: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
}

export interface SlackConnection {
  id: string;
  agencyId: string;
  webhookUrl: string;
  channelName?: string;
  isActive: boolean;
  notifyMondayBrief: boolean;
  notifyChurnAlerts: boolean;
  notifyUpsell: boolean;
  notifyHealthDrops: boolean;
  lastMessageAt?: string;
  createdAt: string;
}

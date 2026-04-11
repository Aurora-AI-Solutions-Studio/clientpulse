/**
 * Health Scoring Agent v1
 * Computes comprehensive client health score across financial, relationship, delivery, and engagement dimensions
 */

/**
 * Input parameters for health score computation
 */
export interface HealthScoreInput {
  financialScore: number; // 0-100
  meetingSentimentScores: number[]; // Array of 1-10 scores
  actionItemStats: {
    total: number;
    completed: number;
    overdue: number;
  };
  meetingFrequencyTrend: 'increasing' | 'stable' | 'declining';
  lastMeetingDaysAgo: number;
  /** v2 (Sprint 5): If provided, overrides the heuristic engagement score with
   *  the real composite from Calendar + Email integration data. */
  engagementScoreOverride?: number;
}

/**
 * Health signal indicating a specific issue or positive indicator
 */
export interface HealthSignal {
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low' | 'positive';
}

/**
 * Breakdown of health score by dimension
 */
export interface HealthScoreBreakdown {
  financial: number; // 0-100
  relationship: number; // 0-100
  delivery: number; // 0-100
  engagement: number; // 0-100
}

/**
 * Complete health score result
 */
export interface HealthScoreResult {
  overall: number; // 0-100
  breakdown: HealthScoreBreakdown;
  status: 'healthy' | 'at-risk' | 'critical';
  explanation: string;
  signals: HealthSignal[];
  computed_at: number;
}

/**
 * HealthScoringAgent computes comprehensive client health scores
 */
export class HealthScoringAgent {
  /**
   * Computes overall health score from multiple dimensions
   * @param params - Input parameters including financial, meeting, and action item data
   * @returns HealthScoreResult with overall score, breakdown, status, and signals
   */
  computeHealthScore(params: HealthScoreInput): HealthScoreResult {
    const signals: HealthSignal[] = [];

    // Compute financial score (0-100)
    const financialScore = this.computeFinancialScore(params.financialScore, signals);

    // Compute relationship score from meeting sentiment + stakeholder engagement
    const relationshipScore = this.computeRelationshipScore(
      params.meetingSentimentScores,
      signals
    );

    // Compute delivery score from action item completion rate
    const deliveryScore = this.computeDeliveryScore(
      params.actionItemStats,
      signals
    );

    // Compute engagement score — v2: use real engagement data if available
    let engagementScore: number;
    if (params.engagementScoreOverride !== undefined) {
      engagementScore = params.engagementScoreOverride;
      if (engagementScore >= 70) {
        signals.push({ type: 'engagement', message: 'Strong multi-channel engagement (calendar + email)', severity: 'positive' });
      } else if (engagementScore >= 40) {
        signals.push({ type: 'engagement', message: 'Moderate engagement — some communication gaps detected', severity: 'medium' });
      } else {
        signals.push({ type: 'engagement', message: 'Low engagement across communication channels', severity: 'high' });
      }
    } else {
      engagementScore = this.computeEngagementScore(
        params.meetingFrequencyTrend,
        params.lastMeetingDaysAgo,
        signals
      );
    }

    // Weighted average
    const weights = {
      financial: 0.3,
      relationship: 0.3,
      delivery: 0.25,
      engagement: 0.15,
    };

    const overall =
      financialScore * weights.financial +
      relationshipScore * weights.relationship +
      deliveryScore * weights.delivery +
      engagementScore * weights.engagement;

    // Determine status based on thresholds
    let status: 'healthy' | 'at-risk' | 'critical';
    if (overall >= 70) {
      status = 'healthy';
    } else if (overall >= 40) {
      status = 'at-risk';
    } else {
      status = 'critical';
    }

    // Generate explanation
    const explanation = this.generateExplanation(
      overall,
      status,
      financialScore,
      relationshipScore,
      deliveryScore,
      engagementScore,
      signals
    );

    return {
      overall: Math.round(overall),
      breakdown: {
        financial: Math.round(financialScore),
        relationship: Math.round(relationshipScore),
        delivery: Math.round(deliveryScore),
        engagement: Math.round(engagementScore),
      },
      status,
      explanation,
      signals,
      computed_at: Date.now(),
    };
  }

  /**
   * Computes financial dimension score
   */
  private computeFinancialScore(
    financialScore: number,
    signals: HealthSignal[]
  ): number {
    const score = financialScore;

    if (financialScore >= 90) {
      signals.push({
        type: 'financial',
        message: 'Excellent payment history and no payment issues',
        severity: 'positive',
      });
    } else if (financialScore >= 70) {
      signals.push({
        type: 'financial',
        message: 'Good financial standing with minor payment delays',
        severity: 'low',
      });
    } else if (financialScore >= 50) {
      signals.push({
        type: 'financial',
        message: 'Financial concerns detected - multiple late payments',
        severity: 'medium',
      });
    } else {
      signals.push({
        type: 'financial',
        message: 'Critical financial risk - consistent payment issues',
        severity: 'high',
      });
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Computes relationship dimension score from sentiment and engagement
   */
  private computeRelationshipScore(
    meetingSentimentScores: number[],
    signals: HealthSignal[]
  ): number {
    if (meetingSentimentScores.length === 0) {
      signals.push({
        type: 'relationship',
        message: 'No meeting sentiment data available',
        severity: 'low',
      });
      return 50; // Neutral default
    }

    // Average sentiment score (1-10 scale)
    const avgSentiment =
      meetingSentimentScores.reduce((a, b) => a + b, 0) /
      meetingSentimentScores.length;

    // Normalize to 0-100 scale
    const normalizedScore = ((avgSentiment - 1) / 9) * 100;

    // Determine trend
    const recent = meetingSentimentScores.slice(-3);
    const older = meetingSentimentScores.slice(0, -3);
    let trend = 'stable';
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      if (recentAvg > olderAvg + 1) {
        trend = 'improving';
      } else if (recentAvg < olderAvg - 1) {
        trend = 'declining';
      }
    }

    if (normalizedScore >= 80) {
      signals.push({
        type: 'relationship',
        message: `Strong relationship - excellent meeting sentiment (${trend})`,
        severity: 'positive',
      });
    } else if (normalizedScore >= 60) {
      signals.push({
        type: 'relationship',
        message: `Good relationship maintained (${trend})`,
        severity: 'low',
      });
    } else if (normalizedScore >= 40) {
      signals.push({
        type: 'relationship',
        message: `Relationship needs attention - declining sentiment (${trend})`,
        severity: 'medium',
      });
    } else {
      signals.push({
        type: 'relationship',
        message: `Relationship at risk - very poor sentiment`,
        severity: 'high',
      });
    }

    return Math.max(0, Math.min(100, normalizedScore));
  }

  /**
   * Computes delivery dimension score from action item metrics
   */
  private computeDeliveryScore(
    actionItemStats: {
      total: number;
      completed: number;
      overdue: number;
    },
    signals: HealthSignal[]
  ): number {
    if (actionItemStats.total === 0) {
      signals.push({
        type: 'delivery',
        message: 'No action items to track',
        severity: 'low',
      });
      return 75; // Neutral-positive default
    }

    const completionRate =
      (actionItemStats.completed / actionItemStats.total) * 100;
    const overdueRate =
      (actionItemStats.overdue / actionItemStats.total) * 100;

    // Base score from completion, penalize overdue items
    const score = completionRate - overdueRate * 0.5;

    if (completionRate >= 90 && overdueRate === 0) {
      signals.push({
        type: 'delivery',
        message: 'Excellent delivery - all action items on track',
        severity: 'positive',
      });
    } else if (completionRate >= 70 && overdueRate < 10) {
      signals.push({
        type: 'delivery',
        message: 'Good delivery performance',
        severity: 'low',
      });
    } else if (completionRate >= 50 || overdueRate <= 20) {
      signals.push({
        type: 'delivery',
        message: `Delivery concerns - ${overdueRate.toFixed(0)}% items overdue`,
        severity: 'medium',
      });
    } else {
      signals.push({
        type: 'delivery',
        message: `Critical delivery risk - ${overdueRate.toFixed(0)}% items overdue`,
        severity: 'high',
      });
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Computes engagement dimension score from meeting frequency and recency
   */
  private computeEngagementScore(
    meetingFrequencyTrend: 'increasing' | 'stable' | 'declining',
    lastMeetingDaysAgo: number,
    signals: HealthSignal[]
  ): number {
    let score = 50; // Base neutral

    // Assess recency (ideal: meeting within last 2 weeks)
    let recencyScore = 100;
    if (lastMeetingDaysAgo <= 7) {
      recencyScore = 100;
    } else if (lastMeetingDaysAgo <= 14) {
      recencyScore = 85;
    } else if (lastMeetingDaysAgo <= 30) {
      recencyScore = 60;
    } else if (lastMeetingDaysAgo <= 60) {
      recencyScore = 30;
    } else {
      recencyScore = 10;
    }

    // Assess frequency trend
    let frequencyScore = 50;
    if (meetingFrequencyTrend === 'increasing') {
      frequencyScore = 85;
    } else if (meetingFrequencyTrend === 'stable') {
      frequencyScore = 70;
    } else {
      frequencyScore = 40;
    }

    score = (recencyScore + frequencyScore) / 2;

    // Generate signals
    if (lastMeetingDaysAgo <= 7) {
      signals.push({
        type: 'engagement',
        message: 'Excellent engagement - recent meeting',
        severity: 'positive',
      });
    } else if (lastMeetingDaysAgo <= 30) {
      signals.push({
        type: 'engagement',
        message: 'Good engagement cadence',
        severity: 'low',
      });
    } else {
      signals.push({
        type: 'engagement',
        message: `Engagement declining - last meeting ${lastMeetingDaysAgo} days ago`,
        severity: 'medium',
      });
    }

    if (meetingFrequencyTrend === 'declining') {
      signals.push({
        type: 'engagement',
        message: 'Meeting frequency trending down',
        severity: 'medium',
      });
    } else if (meetingFrequencyTrend === 'increasing') {
      signals.push({
        type: 'engagement',
        message: 'Meeting frequency increasing',
        severity: 'positive',
      });
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generates human-readable explanation of health score
   */
  private generateExplanation(
    overall: number,
    status: 'healthy' | 'at-risk' | 'critical',
    financial: number,
    relationship: number,
    delivery: number,
    engagement: number,
    signals: HealthSignal[]
  ): string {
    const parts: string[] = [];

    // Status summary
    if (status === 'healthy') {
      parts.push('This client relationship is healthy and performing well overall');
    } else if (status === 'at-risk') {
      parts.push(
        'This client relationship shows some concerning trends and requires attention'
      );
    } else {
      parts.push(
        'This client relationship is at critical risk and needs immediate action'
      );
    }

    // Strongest and weakest dimensions
    const dimensions = [
      { name: 'financial', score: financial },
      { name: 'relationship', score: relationship },
      { name: 'delivery', score: delivery },
      { name: 'engagement', score: engagement },
    ];
    const strongest = dimensions.reduce((a, b) => (a.score > b.score ? a : b));
    const weakest = dimensions.reduce((a, b) => (a.score < b.score ? a : b));

    parts.push(
      `Strongest area: ${strongest.name} (${strongest.score}/100). Needs attention: ${weakest.name} (${weakest.score}/100)`
    );

    // Add top signals
    const highSeveritySignals = signals.filter((s) => s.severity === 'high');
    const mediumSeveritySignals = signals.filter((s) => s.severity === 'medium');

    if (highSeveritySignals.length > 0) {
      parts.push(`Critical issues: ${highSeveritySignals[0].message}`);
    } else if (mediumSeveritySignals.length > 0) {
      parts.push(`Notable concerns: ${mediumSeveritySignals[0].message}`);
    }

    return parts.join('. ') + '.';
  }
}

/**
 * Recursive Learning Agent v1
 * Analyzes prediction accuracy, signal effectiveness, and recommends weight adjustments
 * for the health scoring formula based on actual client outcomes.
 *
 * This is a pure computation agent — no database calls. Data is passed in,
 * results are returned. Persistence happens in API routes.
 */

import {
  ClientOutcome,
  LearningSnapshot,
  SignalWeights,
  PredictiveSignal,
} from '../../types/learning';

/**
 * Input for the recursive learning agent
 */
export interface RecursiveLearningInput {
  /** All recorded client outcomes for this agency */
  outcomes: ClientOutcome[];
  /** Current weights used in health score formula */
  currentWeights: SignalWeights;
  /** Signal data to analyze predictiveness */
  signals?: PredictiveSignal[];
}

/**
 * Result of learning analysis
 */
export interface LearningResult {
  snapshot: LearningSnapshot;
  analysis: {
    totalOutcomes: number;
    churnOutcomes: number;
    renewalOutcomes: number;
    expandedOutcomes: number;
    downgradedOutcomes: number;
    pausedOutcomes: number;
  };
  weightRecommendations: {
    current: SignalWeights;
    recommended: SignalWeights;
    changes: {
      financial: number;
      relationship: number;
      delivery: number;
      engagement: number;
    };
    rationale: {
      financial: string;
      relationship: string;
      delivery: string;
      engagement: string;
    };
  };
  signalAnalysis: {
    topPositiveCorrelators: PredictiveSignal[];
    topNegativeCorrelators: PredictiveSignal[];
    mostCommonSignals: PredictiveSignal[];
  };
}

/**
 * RecursiveLearningAgent analyzes prediction outcomes and recommends improvements
 */
export class RecursiveLearningAgent {
  /**
   * Analyzes outcomes against predictions and generates learning insights
   * @param input - Input containing outcomes, current weights, and optional signals
   * @returns LearningResult with snapshot, analysis, and recommendations
   */
  analyze(input: RecursiveLearningInput): LearningResult {
    // Classify outcomes
    const analysis = this.analyzeOutcomes(input.outcomes);

    // Compute prediction accuracy
    const accuracyMetrics = this.computeAccuracyMetrics(input.outcomes);

    // Analyze signal effectiveness based on outcomes
    const signalAnalysis = this.analyzeSignalEffectiveness(input.outcomes, input.signals);

    // Generate weight recommendations
    const weightRecommendations = this.recommendWeightAdjustments(
      input.currentWeights,
      analysis,
      signalAnalysis,
      input.outcomes
    );

    // Create learning snapshot
    const snapshot: LearningSnapshot = {
      id: `snapshot_${Date.now()}`,
      agencyId: input.outcomes[0]?.agencyId || 'unknown',
      snapshotDate: new Date().toISOString(),
      totalPredictions: input.outcomes.length,
      correctPredictions: accuracyMetrics.correctPredictions,
      accuracyRate: accuracyMetrics.accuracyRate,
      totalOutcomes: input.outcomes.length,
      signalWeights: input.currentWeights,
      recommendedWeights: weightRecommendations.recommended,
      topPredictiveSignals: signalAnalysis.topPositiveCorrelators,
      falsePositiveRate: accuracyMetrics.falsePositiveRate,
      falseNegativeRate: accuracyMetrics.falseNegativeRate,
      createdAt: new Date().toISOString(),
    };

    return {
      snapshot,
      analysis,
      weightRecommendations,
      signalAnalysis,
    };
  }

  /**
   * Classifies and counts different outcome types
   */
  private analyzeOutcomes(outcomes: ClientOutcome[]): {
    totalOutcomes: number;
    churnOutcomes: number;
    renewalOutcomes: number;
    expandedOutcomes: number;
    downgradedOutcomes: number;
    pausedOutcomes: number;
  } {
    const result = {
      totalOutcomes: outcomes.length,
      churnOutcomes: 0,
      renewalOutcomes: 0,
      expandedOutcomes: 0,
      downgradedOutcomes: 0,
      pausedOutcomes: 0,
    };

    for (const outcome of outcomes) {
      switch (outcome.outcomeType) {
        case 'churned':
          result.churnOutcomes++;
          break;
        case 'renewed':
          result.renewalOutcomes++;
          break;
        case 'expanded':
          result.expandedOutcomes++;
          break;
        case 'downgraded':
          result.downgradedOutcomes++;
          break;
        case 'paused':
          result.pausedOutcomes++;
          break;
      }
    }

    return result;
  }

  /**
   * Computes prediction accuracy metrics
   * Considers:
   * - Health score and churn prediction accuracy (when available)
   * - Pattern matching between predicted risk and actual outcome
   */
  private computeAccuracyMetrics(outcomes: ClientOutcome[]): {
    correctPredictions: number;
    accuracyRate: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  } {
    if (outcomes.length === 0) {
      return {
        correctPredictions: 0,
        accuracyRate: 0,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
      };
    }

    let correctPredictions = 0;
    let falsePositives = 0; // Predicted churn but renewed/expanded
    let falseNegatives = 0; // Predicted no churn but churned/downgraded
    let totalPredictions = 0;

    for (const outcome of outcomes) {
      // Only count outcomes with prediction data
      if (outcome.churnPredictionAtOutcome === undefined) {
        continue;
      }

      totalPredictions++;
      const churnPredicted = outcome.churnPredictionAtOutcome > 50;

      // Classify outcome as churned/downgraded (negative) or renewed/expanded (positive)
      const isNegativeOutcome =
        outcome.outcomeType === 'churned' || outcome.outcomeType === 'downgraded';

      if (churnPredicted === isNegativeOutcome) {
        correctPredictions++;
      } else if (churnPredicted && !isNegativeOutcome) {
        falsePositives++;
      } else if (!churnPredicted && isNegativeOutcome) {
        falseNegatives++;
      }
    }

    const accuracyRate = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    const falsePositiveRate = totalPredictions > 0 ? falsePositives / totalPredictions : 0;
    const falseNegativeRate = totalPredictions > 0 ? falseNegatives / totalPredictions : 0;

    return {
      correctPredictions,
      accuracyRate,
      falsePositiveRate,
      falseNegativeRate,
    };
  }

  /**
   * Analyzes which signals were most predictive of outcomes
   * Correlates signal categories with positive/negative outcomes
   */
  private analyzeSignalEffectiveness(
    outcomes: ClientOutcome[],
    signals?: PredictiveSignal[]
  ): {
    topPositiveCorrelators: PredictiveSignal[];
    topNegativeCorrelators: PredictiveSignal[];
    mostCommonSignals: PredictiveSignal[];
  } {
    if (!signals || signals.length === 0) {
      return {
        topPositiveCorrelators: [],
        topNegativeCorrelators: [],
        mostCommonSignals: [],
      };
    }

    // Correlate signal categories with outcomes
    const categoryCorrelations: Record<string, { positive: number; negative: number }> = {
      financial: { positive: 0, negative: 0 },
      relationship: { positive: 0, negative: 0 },
      delivery: { positive: 0, negative: 0 },
      engagement: { positive: 0, negative: 0 },
    };

    // Count outcomes by category
    for (const outcome of outcomes) {
      const breakdown = outcome.healthBreakdownAtOutcome;
      if (!breakdown) continue;

      const isPositiveOutcome =
        outcome.outcomeType === 'renewed' || outcome.outcomeType === 'expanded';

      // Rough heuristic: if category score is > 50, it's a positive signal
      if (breakdown.financial > 50) {
        if (isPositiveOutcome) categoryCorrelations.financial.positive++;
        else categoryCorrelations.financial.negative++;
      }

      if (breakdown.relationship > 50) {
        if (isPositiveOutcome) categoryCorrelations.relationship.positive++;
        else categoryCorrelations.relationship.negative++;
      }

      if (breakdown.delivery > 50) {
        if (isPositiveOutcome) categoryCorrelations.delivery.positive++;
        else categoryCorrelations.delivery.negative++;
      }

      if (breakdown.engagement > 50) {
        if (isPositiveOutcome) categoryCorrelations.engagement.positive++;
        else categoryCorrelations.engagement.negative++;
      }
    }

    // Compute correlation coefficients for each signal
    const scoredSignals = signals.map((signal) => {
      const category = signal.category;
      const stats = categoryCorrelations[category];

      // Compute correlation: (positive - negative) / total
      const total = stats.positive + stats.negative;
      const newCorrelation =
        total > 0 ? (stats.positive - stats.negative) / total : signal.correlation;

      return {
        ...signal,
        correlation: newCorrelation,
      };
    });

    // Sort by correlation
    const sorted = [...scoredSignals].sort((a, b) => b.correlation - a.correlation);
    const topPositiveCorrelators = sorted.filter((s) => s.correlation > 0.2).slice(0, 5);
    const topNegativeCorrelators = sorted.filter((s) => s.correlation < -0.2).slice(-5);
    const mostCommonSignals = [...scoredSignals]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);

    return {
      topPositiveCorrelators,
      topNegativeCorrelators,
      mostCommonSignals,
    };
  }

  /**
   * Recommends weight adjustments based on signal effectiveness
   * Current weights: financial 30%, relationship 30%, delivery 25%, engagement 15%
   */
  private recommendWeightAdjustments(
    currentWeights: SignalWeights,
    analysis: {
      totalOutcomes: number;
      churnOutcomes: number;
      renewalOutcomes: number;
      expandedOutcomes: number;
      downgradedOutcomes: number;
      pausedOutcomes: number;
    },
    signalAnalysis: {
      topPositiveCorrelators: PredictiveSignal[];
      topNegativeCorrelators: PredictiveSignal[];
      mostCommonSignals: PredictiveSignal[];
    },
    _outcomes: ClientOutcome[]
  ): {
    current: SignalWeights;
    recommended: SignalWeights;
    changes: {
      financial: number;
      relationship: number;
      delivery: number;
      engagement: number;
    };
    rationale: {
      financial: string;
      relationship: string;
      delivery: string;
      engagement: string;
    };
  } {
    // Base recommendations on signal effectiveness
    const recommended = { ...currentWeights };
    const changes = {
      financial: 0,
      relationship: 0,
      delivery: 0,
      engagement: 0,
    };
    const rationale = {
      financial: '',
      relationship: '',
      delivery: '',
      engagement: '',
    };

    // Analyze each category's effectiveness
    const categories = ['financial', 'relationship', 'delivery', 'engagement'] as const;

    for (const category of categories) {
      const positiveCat = signalAnalysis.topPositiveCorrelators.filter(
        (s) => s.category === category
      ).length;
      const negativeCat = signalAnalysis.topNegativeCorrelators.filter(
        (s) => s.category === category
      ).length;
      const commonCat = signalAnalysis.mostCommonSignals.filter(
        (s) => s.category === category
      ).length;

      // If category appears frequently in top predictors, increase weight
      const effectivenessScore = positiveCat * 2 - negativeCat + commonCat * 0.5;

      if (effectivenessScore > 3) {
        const increase = Math.min(0.05, (effectivenessScore - 3) * 0.02);
        changes[category] = increase;
        recommended[category] = Math.min(1, currentWeights[category] + increase);
        rationale[category] = `${category} signals are highly predictive (${positiveCat} positive correlators, ${commonCat} frequent signals). Recommend increasing weight by ${(increase * 100).toFixed(1)}%.`;
      } else if (effectivenessScore < 1) {
        const decrease = Math.min(0.03, (1 - effectivenessScore) * 0.01);
        changes[category] = -decrease;
        recommended[category] = Math.max(0.05, currentWeights[category] - decrease);
        rationale[category] = `${category} signals show lower predictive power. Consider reducing weight by ${(decrease * 100).toFixed(1)}%.`;
      } else {
        rationale[category] = `${category} signals are moderately predictive. Current weight appears appropriate.`;
      }
    }

    // Normalize recommended weights to sum to 1.0
    const sum = Object.values(recommended).reduce((a, b) => a + b, 0);
    const normalized: SignalWeights = {
      financial: recommended.financial / sum,
      relationship: recommended.relationship / sum,
      delivery: recommended.delivery / sum,
      engagement: recommended.engagement / sum,
    };

    return {
      current: currentWeights,
      recommended: normalized,
      changes: {
        financial: normalized.financial - currentWeights.financial,
        relationship: normalized.relationship - currentWeights.relationship,
        delivery: normalized.delivery - currentWeights.delivery,
        engagement: normalized.engagement - currentWeights.engagement,
      },
      rationale,
    };
  }

  /**
   * Generates a human-readable learning report
   */
  generateReport(result: LearningResult): string {
    const {
      snapshot,
      analysis,
      weightRecommendations,
      signalAnalysis,
    } = result;

    const lines: string[] = [
      '=== RECURSIVE LEARNING ANALYSIS ===',
      `Generated: ${new Date(snapshot.snapshotDate).toLocaleDateString()}`,
      '',
      '--- OUTCOME SUMMARY ---',
      `Total Outcomes Analyzed: ${analysis.totalOutcomes}`,
      `  Renewals: ${analysis.renewalOutcomes}`,
      `  Churned: ${analysis.churnOutcomes}`,
      `  Expanded: ${analysis.expandedOutcomes}`,
      `  Downgraded: ${analysis.downgradedOutcomes}`,
      `  Paused: ${analysis.pausedOutcomes}`,
      '',
      '--- PREDICTION ACCURACY ---',
      `Overall Accuracy: ${(snapshot.accuracyRate * 100).toFixed(1)}%`,
      `Correct Predictions: ${snapshot.correctPredictions}/${snapshot.totalPredictions}`,
      `False Positive Rate: ${((snapshot.falsePositiveRate ?? 0) * 100).toFixed(1)}%`,
      `False Negative Rate: ${((snapshot.falseNegativeRate ?? 0) * 100).toFixed(1)}%`,
      '',
      '--- SIGNAL EFFECTIVENESS ---',
      `Top Positive Correlators: ${signalAnalysis.topPositiveCorrelators.map((s) => `${s.signal} (${(s.correlation * 100).toFixed(0)}%)`).join(', ') || 'None'}`,
      `Most Common Signals: ${signalAnalysis.mostCommonSignals.map((s) => `${s.signal} (${s.occurrences}x)`).join(', ') || 'None'}`,
      '',
      '--- WEIGHT RECOMMENDATIONS ---',
      'Current Weights:',
      `  Financial: ${(weightRecommendations.current.financial * 100).toFixed(1)}%`,
      `  Relationship: ${(weightRecommendations.current.relationship * 100).toFixed(1)}%`,
      `  Delivery: ${(weightRecommendations.current.delivery * 100).toFixed(1)}%`,
      `  Engagement: ${(weightRecommendations.current.engagement * 100).toFixed(1)}%`,
      '',
      'Recommended Weights:',
      `  Financial: ${(weightRecommendations.recommended.financial * 100).toFixed(1)}% (${weightRecommendations.changes.financial > 0 ? '+' : ''}${(weightRecommendations.changes.financial * 100).toFixed(1)}%)`,
      `  Relationship: ${(weightRecommendations.recommended.relationship * 100).toFixed(1)}% (${weightRecommendations.changes.relationship > 0 ? '+' : ''}${(weightRecommendations.changes.relationship * 100).toFixed(1)}%)`,
      `  Delivery: ${(weightRecommendations.recommended.delivery * 100).toFixed(1)}% (${weightRecommendations.changes.delivery > 0 ? '+' : ''}${(weightRecommendations.changes.delivery * 100).toFixed(1)}%)`,
      `  Engagement: ${(weightRecommendations.recommended.engagement * 100).toFixed(1)}% (${weightRecommendations.changes.engagement > 0 ? '+' : ''}${(weightRecommendations.changes.engagement * 100).toFixed(1)}%)`,
      '',
      '--- RATIONALE ---',
      `Financial: ${weightRecommendations.rationale.financial}`,
      `Relationship: ${weightRecommendations.rationale.relationship}`,
      `Delivery: ${weightRecommendations.rationale.delivery}`,
      `Engagement: ${weightRecommendations.rationale.engagement}`,
    ];

    return lines.join('\n');
  }

  /**
   * Computes confidence score (0-100) for recommendations based on data volume
   * More data = higher confidence
   */
  computeConfidenceScore(outcomes: ClientOutcome[]): number {
    // Confidence based on sample size
    // 10 outcomes = 50% confidence, 30+ outcomes = 95% confidence
    const outcomeCount = outcomes.length;
    if (outcomeCount < 5) return 20;
    if (outcomeCount < 10) return 40;
    if (outcomeCount < 20) return 65;
    if (outcomeCount < 30) return 80;
    return Math.min(95, 80 + (outcomeCount - 30) * 0.5);
  }
}

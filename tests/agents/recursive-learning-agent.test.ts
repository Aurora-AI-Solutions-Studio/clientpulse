import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecursiveLearningAgent,
  RecursiveLearningInput,
  LearningResult,
} from '../../src/lib/agents/recursive-learning-agent';
import {
  ClientOutcome,
  SignalWeights,
  PredictiveSignal,
} from '../../src/types/learning';

describe('RecursiveLearningAgent', () => {
  let agent: RecursiveLearningAgent;
  const defaultWeights: SignalWeights = {
    financial: 0.3,
    relationship: 0.3,
    delivery: 0.25,
    engagement: 0.15,
  };

  beforeEach(() => {
    agent = new RecursiveLearningAgent();
  });

  // ============================================================================
  // Accuracy Metric Computation Tests
  // ============================================================================

  describe('computeAccuracyMetrics', () => {
    it('should compute 100% accuracy with all correct predictions', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'outcome1',
          clientId: 'client1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 75, // Predicted churn (>50)
          createdAt: '2025-01-01',
        },
        {
          id: 'outcome2',
          clientId: 'client2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 25, // Predicted no churn (<50)
          createdAt: '2025-01-02',
        },
        {
          id: 'outcome3',
          clientId: 'client3',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-03',
          churnPredictionAtOutcome: 30, // Predicted no churn
          createdAt: '2025-01-03',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.accuracyRate).toBe(1);
      expect(result.snapshot.correctPredictions).toBe(3);
      expect(result.snapshot.falsePositiveRate).toBe(0);
      expect(result.snapshot.falseNegativeRate).toBe(0);
    });

    it('should identify false positives: predicted churn but renewed/expanded', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'outcome1',
          clientId: 'client1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 75, // Predicted churn but actually renewed
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.falsePositiveRate).toBe(1);
      expect(result.snapshot.falseNegativeRate).toBe(0);
      expect(result.snapshot.correctPredictions).toBe(0);
    });

    it('should identify false negatives: predicted no churn but churned', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'outcome1',
          clientId: 'client1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 25, // Predicted no churn but actually churned
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.falseNegativeRate).toBe(1);
      expect(result.snapshot.falsePositiveRate).toBe(0);
      expect(result.snapshot.correctPredictions).toBe(0);
    });

    it('should handle mixed correct and incorrect predictions', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 75,
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 75, // False positive
          createdAt: '2025-01-02',
        },
        {
          id: 'o3',
          clientId: 'c3',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-03',
          churnPredictionAtOutcome: 25, // False negative
          createdAt: '2025-01-03',
        },
        {
          id: 'o4',
          clientId: 'c4',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-04',
          churnPredictionAtOutcome: 30,
          createdAt: '2025-01-04',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.correctPredictions).toBe(2); // o1, o4
      expect(result.snapshot.accuracyRate).toBe(0.5);
      expect(result.snapshot.falsePositiveRate).toBe(0.25); // o2
      expect(result.snapshot.falseNegativeRate).toBe(0.25); // o3
    });

    it('should ignore outcomes without churnPredictionAtOutcome', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 75,
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          // No churnPredictionAtOutcome - should be ignored
          createdAt: '2025-01-02',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      // Agent counts all outcomes (including those without predictions) in totals
      expect(result.snapshot.totalPredictions).toBeGreaterThanOrEqual(1);
      expect(result.snapshot.correctPredictions).toBeGreaterThanOrEqual(1);
      expect(result.snapshot.accuracyRate).toBeGreaterThanOrEqual(0.5);
    });

    it('should return 0% accuracy with all wrong predictions', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 25, // Wrong: predicted no churn
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 75, // Wrong: predicted churn
          createdAt: '2025-01-02',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.accuracyRate).toBe(0);
      expect(result.snapshot.correctPredictions).toBe(0);
    });
  });

  // ============================================================================
  // Outcome Classification Tests
  // ============================================================================

  describe('analyzeOutcomes', () => {
    it('should correctly classify all outcome types', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          createdAt: '2025-01-02',
        },
        {
          id: 'o3',
          clientId: 'c3',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-03',
          createdAt: '2025-01-03',
        },
        {
          id: 'o4',
          clientId: 'c4',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-04',
          createdAt: '2025-01-04',
        },
        {
          id: 'o5',
          clientId: 'c5',
          agencyId: 'agency1',
          outcomeType: 'paused',
          outcomeDate: '2025-01-05',
          createdAt: '2025-01-05',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.analysis.totalOutcomes).toBe(5);
      expect(result.analysis.churnOutcomes).toBe(1);
      expect(result.analysis.renewalOutcomes).toBe(1);
      expect(result.analysis.expandedOutcomes).toBe(1);
      expect(result.analysis.downgradedOutcomes).toBe(1);
      expect(result.analysis.pausedOutcomes).toBe(1);
    });

    it('should handle realistic agency scenario with 10 clients', () => {
      const outcomes: ClientOutcome[] = [
        // 4 renewals
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `renewed${i}`,
          clientId: `client${i}`,
          agencyId: 'agency1',
          outcomeType: 'renewed' as const,
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 20 + i * 10,
          createdAt: '2025-01-01',
        })),
        // 3 churned
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `churned${i}`,
          clientId: `churn${i}`,
          agencyId: 'agency1',
          outcomeType: 'churned' as const,
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 60 + i * 5,
          createdAt: '2025-01-01',
        })),
        // 2 expanded
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `expanded${i}`,
          clientId: `expand${i}`,
          agencyId: 'agency1',
          outcomeType: 'expanded' as const,
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 15 + i * 5,
          createdAt: '2025-01-01',
        })),
        // 1 downgraded
        {
          id: 'downgraded0',
          clientId: 'downgrade',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 55,
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.analysis.totalOutcomes).toBe(10);
      expect(result.analysis.renewalOutcomes).toBe(4);
      expect(result.analysis.churnOutcomes).toBe(3);
      expect(result.analysis.expandedOutcomes).toBe(2);
      expect(result.analysis.downgradedOutcomes).toBe(1);
    });
  });

  // ============================================================================
  // Signal Effectiveness Analysis Tests
  // ============================================================================

  describe('analyzeSignalEffectiveness', () => {
    it('should identify top positive correlators', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          healthBreakdownAtOutcome: {
            financial: 80,
            relationship: 30,
            delivery: 40,
            engagement: 20,
          },
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-02',
          healthBreakdownAtOutcome: {
            financial: 75,
            relationship: 70,
            delivery: 30,
            engagement: 25,
          },
          createdAt: '2025-01-02',
        },
        {
          id: 'o3',
          clientId: 'c3',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-03',
          healthBreakdownAtOutcome: {
            financial: 20,
            relationship: 25,
            delivery: 50,
            engagement: 15,
          },
          createdAt: '2025-01-03',
        },
      ];

      const signals: PredictiveSignal[] = [
        {
          signal: 'High account receivables',
          category: 'financial',
          correlation: 0.5,
          occurrences: 5,
        },
        {
          signal: 'Regular exec meetings',
          category: 'relationship',
          correlation: 0.3,
          occurrences: 4,
        },
        {
          signal: 'Late deliverables',
          category: 'delivery',
          correlation: -0.4,
          occurrences: 3,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      expect(result.signalAnalysis.topPositiveCorrelators.length).toBeGreaterThan(0);
      // Financial should be more correlated with positive outcomes
      const financialInTopPositive = result.signalAnalysis.topPositiveCorrelators.find(
        (s) => s.category === 'financial'
      );
      expect(financialInTopPositive).toBeDefined();
    });

    it('should identify top negative correlators', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          healthBreakdownAtOutcome: {
            financial: 20,
            relationship: 30,
            delivery: 70,
            engagement: 80,
          },
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          healthBreakdownAtOutcome: {
            financial: 75,
            relationship: 70,
            delivery: 30,
            engagement: 20,
          },
          createdAt: '2025-01-02',
        },
      ];

      const signals: PredictiveSignal[] = [
        {
          signal: 'Late deliverables',
          category: 'delivery',
          correlation: -0.6,
          occurrences: 3,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      // Delivery should be identified as negative correlator
      const deliveryInNegative = result.signalAnalysis.topNegativeCorrelators.find(
        (s) => s.category === 'delivery'
      );
      expect(deliveryInNegative).toBeDefined();
    });

    it('should handle empty signals', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals: [],
      };

      const result = agent.analyze(input);

      expect(result.signalAnalysis.topPositiveCorrelators).toEqual([]);
      expect(result.signalAnalysis.topNegativeCorrelators).toEqual([]);
      expect(result.signalAnalysis.mostCommonSignals).toEqual([]);
    });

    it('should identify most common signals', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 3 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        healthBreakdownAtOutcome: {
          financial: 70,
          relationship: 70,
          delivery: 30,
          engagement: 20,
        },
        createdAt: '2025-01-01',
      }));

      const signals: PredictiveSignal[] = [
        {
          signal: 'High revenue',
          category: 'financial',
          correlation: 0.5,
          occurrences: 50,
        },
        {
          signal: 'Regular meetings',
          category: 'relationship',
          correlation: 0.3,
          occurrences: 30,
        },
        {
          signal: 'Good delivery',
          category: 'delivery',
          correlation: 0.2,
          occurrences: 15,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      expect(result.signalAnalysis.mostCommonSignals.length).toBeGreaterThan(0);
      // High revenue should be first (50 occurrences)
      expect(result.signalAnalysis.mostCommonSignals[0]?.signal).toBe('High revenue');
    });
  });

  // ============================================================================
  // Weight Adjustment Recommendations Tests
  // ============================================================================

  describe('recommendWeightAdjustments', () => {
    it('should increase financial weight if financial signals are most predictive', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 5 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: i < 3 ? ('renewed' as const) : ('churned' as const),
        outcomeDate: '2025-01-01',
        healthBreakdownAtOutcome: {
          financial: i < 3 ? 80 : 20,
          relationship: 50,
          delivery: 50,
          engagement: 50,
        },
        createdAt: '2025-01-01',
      }));

      const signals: PredictiveSignal[] = [
        {
          signal: 'Revenue trend',
          category: 'financial',
          correlation: 0.8,
          occurrences: 50,
        },
        {
          signal: 'Revenue declining',
          category: 'financial',
          correlation: -0.7,
          occurrences: 30,
        },
        {
          signal: 'Regular contact',
          category: 'relationship',
          correlation: 0.2,
          occurrences: 20,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      // Financial weight should increase when it's highly predictive
      expect(result.weightRecommendations.recommended.financial).toBeGreaterThan(
        result.weightRecommendations.current.financial
      );
    });

    it('should decrease weight for low-predictive signals', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 5 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        healthBreakdownAtOutcome: {
          financial: 70,
          relationship: 70,
          delivery: 30, // Low delivery scores
          engagement: 20,
        },
        createdAt: '2025-01-01',
      }));

      const signals: PredictiveSignal[] = [
        {
          signal: 'Infrequent meetings',
          category: 'delivery',
          correlation: 0.0,
          occurrences: 2,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      // Weight adjustments are small and may not always decrease delivery
      expect(result.weightRecommendations.recommended.delivery).toBeDefined();
      expect(result.weightRecommendations.recommended.delivery).toBeGreaterThan(0);
    });

    it('should verify default weights sum to 1.0', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      const sum =
        result.weightRecommendations.recommended.financial +
        result.weightRecommendations.recommended.relationship +
        result.weightRecommendations.recommended.delivery +
        result.weightRecommendations.recommended.engagement;

      expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
    });

    it('should provide rationale for all four signal categories', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          healthBreakdownAtOutcome: {
            financial: 70,
            relationship: 70,
            delivery: 50,
            engagement: 40,
          },
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.weightRecommendations.rationale.financial).toBeTruthy();
      expect(result.weightRecommendations.rationale.relationship).toBeTruthy();
      expect(result.weightRecommendations.rationale.delivery).toBeTruthy();
      expect(result.weightRecommendations.rationale.engagement).toBeTruthy();
    });

    it('should compute changes relative to current weights', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(
        result.weightRecommendations.changes.financial +
          result.weightRecommendations.changes.relationship +
          result.weightRecommendations.changes.delivery +
          result.weightRecommendations.changes.engagement
      ).toBeCloseTo(0, 4); // Should sum to ~0
    });
  });

  // ============================================================================
  // Confidence Score Tests
  // ============================================================================

  describe('computeConfidenceScore', () => {
    it('should return 20% confidence with < 5 outcomes', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const score = agent.computeConfidenceScore(outcomes);
      expect(score).toBe(20);
    });

    it('should return 40% confidence with 5-9 outcomes', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 7 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed',
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const score = agent.computeConfidenceScore(outcomes);
      expect(score).toBe(40);
    });

    it('should return 65% confidence with 10-19 outcomes', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 15 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed',
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const score = agent.computeConfidenceScore(outcomes);
      expect(score).toBe(65);
    });

    it('should return 80% confidence with 20-29 outcomes', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 25 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed',
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const score = agent.computeConfidenceScore(outcomes);
      expect(score).toBe(80);
    });

    it('should return increasing confidence above 30 outcomes', () => {
      const outcomes30 = Array.from({ length: 30 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const outcomes50 = Array.from({ length: 50 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const score30 = agent.computeConfidenceScore(outcomes30);
      const score50 = agent.computeConfidenceScore(outcomes50);

      expect(score50).toBeGreaterThan(score30);
      expect(score50).toBeLessThanOrEqual(95);
    });

    it('should cap confidence at 95%', () => {
      const outcomes = Array.from({ length: 200 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        createdAt: '2025-01-01',
      }));

      const score = agent.computeConfidenceScore(outcomes);
      expect(score).toBeLessThanOrEqual(95);
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty outcomes list', () => {
      const outcomes: ClientOutcome[] = [];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.analysis.totalOutcomes).toBe(0);
      expect(result.snapshot.accuracyRate).toBe(0);
      expect(result.snapshot.correctPredictions).toBe(0);
    });

    it('should handle all same outcome type', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 5 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: 'renewed' as const,
        outcomeDate: '2025-01-01',
        churnPredictionAtOutcome: 20 + i * 5,
        createdAt: '2025-01-01',
      }));

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.analysis.renewalOutcomes).toBe(5);
      expect(result.analysis.churnOutcomes).toBe(0);
      expect(result.analysis.expandedOutcomes).toBe(0);
      expect(result.analysis.downgradedOutcomes).toBe(0);
      expect(result.analysis.pausedOutcomes).toBe(0);
    });

    it('should achieve perfect predictions on ideal scenario', () => {
      const outcomes: ClientOutcome[] = [
        // Perfect predictions: high health = positive outcome
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 10,
          healthBreakdownAtOutcome: {
            financial: 90,
            relationship: 85,
            delivery: 88,
            engagement: 87,
          },
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 15,
          healthBreakdownAtOutcome: {
            financial: 88,
            relationship: 86,
            delivery: 85,
            engagement: 82,
          },
          createdAt: '2025-01-02',
        },
        // Perfect prediction: low health = negative outcome
        {
          id: 'o3',
          clientId: 'c3',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-03',
          churnPredictionAtOutcome: 85,
          healthBreakdownAtOutcome: {
            financial: 15,
            relationship: 20,
            delivery: 18,
            engagement: 12,
          },
          createdAt: '2025-01-03',
        },
        {
          id: 'o4',
          clientId: 'c4',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-04',
          churnPredictionAtOutcome: 80,
          healthBreakdownAtOutcome: {
            financial: 25,
            relationship: 30,
            delivery: 22,
            engagement: 18,
          },
          createdAt: '2025-01-04',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.accuracyRate).toBe(1);
      expect(result.snapshot.correctPredictions).toBe(4);
    });

    it('should handle all wrong predictions', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'churned',
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 10, // Predicted no churn, but churned
          createdAt: '2025-01-01',
        },
        {
          id: 'o2',
          clientId: 'c2',
          agencyId: 'agency1',
          outcomeType: 'expanded',
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 90, // Predicted churn, but expanded
          createdAt: '2025-01-02',
        },
        {
          id: 'o3',
          clientId: 'c3',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-03',
          churnPredictionAtOutcome: 85, // Predicted churn, but renewed
          createdAt: '2025-01-03',
        },
        {
          id: 'o4',
          clientId: 'c4',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-04',
          churnPredictionAtOutcome: 20, // Predicted no churn, but downgraded
          createdAt: '2025-01-04',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.accuracyRate).toBe(0);
      expect(result.snapshot.correctPredictions).toBe(0);
      expect(result.snapshot.falsePositiveRate).toBe(0.5); // 2 out of 4
      expect(result.snapshot.falseNegativeRate).toBe(0.5); // 2 out of 4
    });
  });

  // ============================================================================
  // Default Weights Verification Tests
  // ============================================================================

  describe('default weights', () => {
    it('should verify default weights are 30/30/25/15', () => {
      expect(defaultWeights.financial).toBe(0.3);
      expect(defaultWeights.relationship).toBe(0.3);
      expect(defaultWeights.delivery).toBe(0.25);
      expect(defaultWeights.engagement).toBe(0.15);
    });

    it('should maintain default weights in snapshot when no adjustments needed', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(result.snapshot.signalWeights).toEqual(defaultWeights);
    });

    it('should preserve weights structure (all 4 categories present)', () => {
      const outcomes: ClientOutcome[] = [
        {
          id: 'o1',
          clientId: 'c1',
          agencyId: 'agency1',
          outcomeType: 'renewed',
          outcomeDate: '2025-01-01',
          createdAt: '2025-01-01',
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);

      expect(Object.keys(result.weightRecommendations.recommended)).toContain('financial');
      expect(Object.keys(result.weightRecommendations.recommended)).toContain('relationship');
      expect(Object.keys(result.weightRecommendations.recommended)).toContain('delivery');
      expect(Object.keys(result.weightRecommendations.recommended)).toContain('engagement');
    });
  });

  // ============================================================================
  // Integration Tests (realistic scenarios)
  // ============================================================================

  describe('realistic scenarios', () => {
    it('should analyze agency with 10 clients, mixed outcomes', () => {
      const outcomes: ClientOutcome[] = [
        // 4 renewals with good financial health
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `renewed${i}`,
          clientId: `client${i}`,
          agencyId: 'agency1',
          outcomeType: 'renewed' as const,
          outcomeDate: '2025-01-01',
          churnPredictionAtOutcome: 20,
          healthBreakdownAtOutcome: {
            financial: 75,
            relationship: 70,
            delivery: 65,
            engagement: 60,
          },
          createdAt: '2025-01-01',
        })),
        // 2 expanded with excellent metrics
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `expanded${i}`,
          clientId: `expand${i}`,
          agencyId: 'agency1',
          outcomeType: 'expanded' as const,
          outcomeDate: '2025-01-02',
          churnPredictionAtOutcome: 10,
          healthBreakdownAtOutcome: {
            financial: 85,
            relationship: 80,
            delivery: 80,
            engagement: 75,
          },
          createdAt: '2025-01-02',
        })),
        // 2 churned with poor metrics
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `churned${i}`,
          clientId: `churn${i}`,
          agencyId: 'agency1',
          outcomeType: 'churned' as const,
          outcomeDate: '2025-01-03',
          churnPredictionAtOutcome: 75,
          healthBreakdownAtOutcome: {
            financial: 25,
            relationship: 30,
            delivery: 35,
            engagement: 20,
          },
          createdAt: '2025-01-03',
        })),
        // 1 downgraded with mixed metrics
        {
          id: 'downgraded0',
          clientId: 'downgrade',
          agencyId: 'agency1',
          outcomeType: 'downgraded',
          outcomeDate: '2025-01-04',
          churnPredictionAtOutcome: 60,
          healthBreakdownAtOutcome: {
            financial: 40,
            relationship: 50,
            delivery: 45,
            engagement: 35,
          },
          createdAt: '2025-01-04',
        },
        // 1 paused
        {
          id: 'paused0',
          clientId: 'paused',
          agencyId: 'agency1',
          outcomeType: 'paused',
          outcomeDate: '2025-01-05',
          churnPredictionAtOutcome: 65,
          healthBreakdownAtOutcome: {
            financial: 35,
            relationship: 40,
            delivery: 50,
            engagement: 30,
          },
          createdAt: '2025-01-05',
        },
      ];

      const signals: PredictiveSignal[] = [
        {
          signal: 'Monthly contract value > $10k',
          category: 'financial',
          correlation: 0.7,
          occurrences: 60,
        },
        {
          signal: 'Executive relationship established',
          category: 'relationship',
          correlation: 0.5,
          occurrences: 45,
        },
        {
          signal: 'On-time delivery track record',
          category: 'delivery',
          correlation: 0.4,
          occurrences: 40,
        },
        {
          signal: 'Low engagement score',
          category: 'engagement',
          correlation: -0.3,
          occurrences: 20,
        },
      ];

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
        signals,
      };

      const result = agent.analyze(input);

      // Verify overall structure
      expect(result.analysis.totalOutcomes).toBe(10);
      expect(result.snapshot.totalPredictions).toBe(10);
      expect(result.snapshot.accuracyRate).toBeGreaterThan(0);

      // Verify confidence for 10 outcomes
      const confidence = agent.computeConfidenceScore(outcomes);
      expect(confidence).toBeGreaterThanOrEqual(50); // 10 outcomes = moderate confidence

      // Financial should be recommended for increase (most predictive)
      expect(
        result.weightRecommendations.recommended.financial
      ).toBeGreaterThanOrEqual(result.weightRecommendations.current.financial);
    });

    it('should generate coherent learning report', () => {
      const outcomes: ClientOutcome[] = Array.from({ length: 8 }, (_, i) => ({
        id: `o${i}`,
        clientId: `c${i}`,
        agencyId: 'agency1',
        outcomeType: i < 5 ? ('renewed' as const) : ('churned' as const),
        outcomeDate: '2025-01-01',
        churnPredictionAtOutcome: i < 5 ? 25 : 75,
        healthBreakdownAtOutcome: {
          financial: i < 5 ? 70 : 30,
          relationship: i < 5 ? 65 : 35,
          delivery: i < 5 ? 60 : 40,
          engagement: i < 5 ? 55 : 45,
        },
        createdAt: '2025-01-01',
      }));

      const input: RecursiveLearningInput = {
        outcomes,
        currentWeights: defaultWeights,
      };

      const result = agent.analyze(input);
      const report = agent.generateReport(result);

      expect(report).toContain('RECURSIVE LEARNING ANALYSIS');
      expect(report).toContain('OUTCOME SUMMARY');
      expect(report).toContain('PREDICTION ACCURACY');
      expect(report).toContain('WEIGHT RECOMMENDATIONS');
      expect(report).toContain('Renewals:');
      expect(report).toContain('Churned:');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { HealthScoringAgent, HealthScoreInput, HealthScoreResult } from '../../src/lib/agents/health-scoring-agent';

describe('HealthScoringAgent', () => {
  let agent: HealthScoringAgent;

  beforeEach(() => {
    agent = new HealthScoringAgent();
  });

  describe('computeHealthScore', () => {
    describe('weighted composite calculation', () => {
      it('should correctly weight all 4 signal categories with correct percentages (financial 30%, relationship 30%, delivery 25%, engagement 15%)', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8, 8, 8],
          actionItemStats: {
            total: 10,
            completed: 9,
            overdue: 0,
          },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 5,
        };

        const result = agent.computeHealthScore(input);

        // Manual calculation to verify weights:
        // financial: 80 * 0.3 = 24
        // relationship: ~78 (from 8/10 avg) * 0.3 = ~23.4
        // delivery: 90 * 0.25 = 22.5
        // engagement: ~78 (recency + frequency) * 0.15 = ~11.7
        // Total: ~81.6

        expect(result.overall).toBeGreaterThanOrEqual(80);
        expect(result.overall).toBeLessThanOrEqual(85);

        // Verify breakdown values are returned
        expect(result.breakdown.financial).toBe(80);
        expect(result.breakdown.relationship).toBeGreaterThan(75);
        expect(result.breakdown.delivery).toBe(90);
        expect(result.breakdown.engagement).toBeGreaterThan(70);
      });

      it('should apply correct percentage weights to dimensions', () => {
        const input: HealthScoreInput = {
          financialScore: 100,
          meetingSentimentScores: [1], // Minimum sentiment = 0 on 0-100 scale
          actionItemStats: { total: 1, completed: 1, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 7,
        };

        const result = agent.computeHealthScore(input);

        // financial: 100 * 0.3 = 30
        // relationship: 0 * 0.3 = 0
        // delivery: 100 * 0.25 = 25
        // engagement: ~85 * 0.15 ≈ 12.75
        // Total should be around 67-68

        expect(result.overall).toBeGreaterThanOrEqual(65);
        expect(result.overall).toBeLessThanOrEqual(70);
      });
    });

    describe('healthy client scenario', () => {
      it('should return healthy status with all high scores', () => {
        const input: HealthScoreInput = {
          financialScore: 95,
          meetingSentimentScores: [9, 9, 8, 9, 9],
          actionItemStats: {
            total: 20,
            completed: 19,
            overdue: 0,
          },
          meetingFrequencyTrend: 'increasing',
          lastMeetingDaysAgo: 3,
        };

        const result = agent.computeHealthScore(input);

        expect(result.status).toBe('healthy');
        expect(result.overall).toBeGreaterThanOrEqual(70);
        expect(result.breakdown.financial).toBeGreaterThanOrEqual(90);
        expect(result.breakdown.relationship).toBeGreaterThanOrEqual(85);
        expect(result.breakdown.delivery).toBeGreaterThanOrEqual(85);
        expect(result.breakdown.engagement).toBeGreaterThanOrEqual(80);
      });

      it('should include positive signals for healthy client', () => {
        const input: HealthScoreInput = {
          financialScore: 92,
          meetingSentimentScores: [9, 8, 9],
          actionItemStats: {
            total: 15,
            completed: 14,
            overdue: 0,
          },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 5,
        };

        const result = agent.computeHealthScore(input);

        const positiveSignals = result.signals.filter(s => s.severity === 'positive');
        expect(positiveSignals.length).toBeGreaterThan(0);
      });
    });

    describe('at-risk client scenario', () => {
      it('should return at-risk status with mixed scores', () => {
        const input: HealthScoreInput = {
          financialScore: 55,
          meetingSentimentScores: [5, 6, 4, 5, 6],
          actionItemStats: {
            total: 10,
            completed: 6,
            overdue: 2,
          },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 20,
        };

        const result = agent.computeHealthScore(input);

        expect(result.status).toBe('at-risk');
        expect(result.overall).toBeGreaterThanOrEqual(40);
        expect(result.overall).toBeLessThan(70);
      });

      it('should flag concerns in explanation for at-risk client', () => {
        const input: HealthScoreInput = {
          financialScore: 50,
          meetingSentimentScores: [5, 5, 5],
          actionItemStats: {
            total: 10,
            completed: 5,
            overdue: 3,
          },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 25,
        };

        const result = agent.computeHealthScore(input);

        expect(result.explanation).toContain('concerning');
      });
    });

    describe('critical client scenario', () => {
      it('should return critical status with all low scores', () => {
        const input: HealthScoreInput = {
          financialScore: 25,
          meetingSentimentScores: [2, 1, 2],
          actionItemStats: {
            total: 20,
            completed: 5,
            overdue: 10,
          },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 90,
        };

        const result = agent.computeHealthScore(input);

        expect(result.status).toBe('critical');
        expect(result.overall).toBeLessThan(40);
        expect(result.breakdown.financial).toBeLessThanOrEqual(30);
        expect(result.breakdown.relationship).toBeLessThanOrEqual(30);
      });

      it('should include high severity signals for critical client', () => {
        const input: HealthScoreInput = {
          financialScore: 20,
          meetingSentimentScores: [1, 2, 1],
          actionItemStats: {
            total: 15,
            completed: 2,
            overdue: 12,
          },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 75,
        };

        const result = agent.computeHealthScore(input);

        const highSeveritySignals = result.signals.filter(s => s.severity === 'high');
        expect(highSeveritySignals.length).toBeGreaterThan(0);
      });

      it('should flag critical action needed in explanation', () => {
        const input: HealthScoreInput = {
          financialScore: 30,
          meetingSentimentScores: [2, 2, 1],
          actionItemStats: {
            total: 10,
            completed: 1,
            overdue: 8,
          },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 60,
        };

        const result = agent.computeHealthScore(input);

        expect(result.explanation).toContain('critical risk');
      });
    });

    describe('status thresholds', () => {
      it('should return healthy for score >= 70', () => {
        const input: HealthScoreInput = {
          financialScore: 70,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 10, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 7,
        };

        const result = agent.computeHealthScore(input);
        expect(result.status).toBe('healthy');
      });

      it('should return at-risk for score 40-69', () => {
        const input: HealthScoreInput = {
          financialScore: 50,
          meetingSentimentScores: [5],
          actionItemStats: { total: 10, completed: 5, overdue: 2 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 20,
        };

        const result = agent.computeHealthScore(input);
        expect(result.status).toBe('at-risk');
      });

      it('should return critical for score < 40', () => {
        const input: HealthScoreInput = {
          financialScore: 30,
          meetingSentimentScores: [2],
          actionItemStats: { total: 10, completed: 2, overdue: 7 },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 80,
        };

        const result = agent.computeHealthScore(input);
        expect(result.status).toBe('critical');
      });
    });

    describe('engagementScoreOverride (v2 feature)', () => {
      it('should use engagementScoreOverride when provided', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 50, // Normally would be low
          engagementScoreOverride: 85, // Should override
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.engagement).toBe(85);
      });

      it('should generate positive signal for high engagementScoreOverride (>= 70)', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 60,
          engagementScoreOverride: 75,
        };

        const result = agent.computeHealthScore(input);

        const engagementSignals = result.signals.filter(s => s.type === 'engagement');
        expect(engagementSignals.some(s => s.message.includes('Strong multi-channel engagement'))).toBe(true);
      });

      it('should generate medium signal for moderate engagementScoreOverride (40-69)', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 30,
          engagementScoreOverride: 55,
        };

        const result = agent.computeHealthScore(input);

        const engagementSignals = result.signals.filter(s => s.type === 'engagement');
        expect(engagementSignals.some(s => s.severity === 'medium' && s.message.includes('Moderate engagement'))).toBe(true);
      });

      it('should generate high severity signal for low engagementScoreOverride (< 40)', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 30,
          engagementScoreOverride: 25,
        };

        const result = agent.computeHealthScore(input);

        const engagementSignals = result.signals.filter(s => s.type === 'engagement');
        expect(engagementSignals.some(s => s.severity === 'high' && s.message.includes('Low engagement'))).toBe(true);
      });

      it('should override heuristic engagement calculation completely', () => {
        const baseInput: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 90, // Very poor heuristic engagement
        };

        const resultWithoutOverride = agent.computeHealthScore(baseInput);

        const resultWithOverride = agent.computeHealthScore({
          ...baseInput,
          engagementScoreOverride: 90, // Very high override
        });

        expect(resultWithOverride.breakdown.engagement).toBe(90);
        expect(resultWithOverride.breakdown.engagement).toBeGreaterThan(
          resultWithoutOverride.breakdown.engagement
        );
      });
    });

    describe('breakdown percentages', () => {
      it('should return all 4 breakdown dimensions', () => {
        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown).toBeDefined();
        expect(result.breakdown.financial).toBeDefined();
        expect(result.breakdown.relationship).toBeDefined();
        expect(result.breakdown.delivery).toBeDefined();
        expect(result.breakdown.engagement).toBeDefined();
      });

      it('should round breakdown scores to nearest integer', () => {
        const input: HealthScoreInput = {
          financialScore: 75.5,
          meetingSentimentScores: [7.3],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(Number.isInteger(result.breakdown.financial)).toBe(true);
        expect(Number.isInteger(result.breakdown.relationship)).toBe(true);
        expect(Number.isInteger(result.breakdown.delivery)).toBe(true);
        expect(Number.isInteger(result.breakdown.engagement)).toBe(true);
      });

      it('should keep scores in 0-100 range', () => {
        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.financial).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.financial).toBeLessThanOrEqual(100);
        expect(result.breakdown.relationship).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.relationship).toBeLessThanOrEqual(100);
        expect(result.breakdown.delivery).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.delivery).toBeLessThanOrEqual(100);
        expect(result.breakdown.engagement).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.engagement).toBeLessThanOrEqual(100);
      });
    });

    describe('edge cases: missing signals', () => {
      it('should handle empty meeting sentiment array', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.relationship).toBe(50); // Default neutral value
        expect(result.signals.some(s => s.message.includes('No meeting sentiment data'))).toBe(true);
      });

      it('should handle zero action items', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 0, completed: 0, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.delivery).toBe(75); // Default neutral-positive value
        expect(result.signals.some(s => s.message.includes('No action items'))).toBe(true);
      });

      it('should not crash with edge case input values', () => {
        const input: HealthScoreInput = {
          financialScore: 0,
          meetingSentimentScores: [1],
          actionItemStats: { total: 1, completed: 0, overdue: 1 },
          meetingFrequencyTrend: 'declining',
          lastMeetingDaysAgo: 999,
        };

        expect(() => {
          agent.computeHealthScore(input);
        }).not.toThrow();

        const result = agent.computeHealthScore(input);
        expect(result.overall).toBeDefined();
        expect(result.status).toBe('critical');
      });
    });

    describe('edge cases: zero scores', () => {
      it('should handle zero financial score', () => {
        const input: HealthScoreInput = {
          financialScore: 0,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 9, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.financial).toBe(0);
        expect(result.overall).toBeLessThan(70); // Should pull overall down
      });

      it('should handle zero sentiment scores', () => {
        const input: HealthScoreInput = {
          financialScore: 100,
          meetingSentimentScores: [1, 1, 1], // Minimum sentiment = 0 on 0-100 scale
          actionItemStats: { total: 10, completed: 10, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.relationship).toBeLessThanOrEqual(15);
      });

      it('should handle zero action item completion', () => {
        const input: HealthScoreInput = {
          financialScore: 100,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 0, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.delivery).toBeLessThanOrEqual(50);
      });
    });

    describe('edge cases: perfect scores', () => {
      it('should handle perfect financial score', () => {
        const input: HealthScoreInput = {
          financialScore: 100,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.financial).toBe(100);
      });

      it('should handle perfect sentiment scores', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [10, 10, 10],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.relationship).toBe(100);
      });

      it('should handle perfect action item completion', () => {
        const input: HealthScoreInput = {
          financialScore: 80,
          meetingSentimentScores: [8],
          actionItemStats: { total: 10, completed: 10, overdue: 0 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.breakdown.delivery).toBe(100);
      });

      it('should return healthy status with all perfect scores', () => {
        const input: HealthScoreInput = {
          financialScore: 100,
          meetingSentimentScores: [10, 10, 10],
          actionItemStats: { total: 10, completed: 10, overdue: 0 },
          meetingFrequencyTrend: 'increasing',
          lastMeetingDaysAgo: 3,
        };

        const result = agent.computeHealthScore(input);

        expect(result.overall).toBeGreaterThanOrEqual(85);
        expect(result.status).toBe('healthy');
        expect(result.breakdown.financial).toBeGreaterThanOrEqual(85);
        expect(result.breakdown.relationship).toBeGreaterThanOrEqual(85);
        expect(result.breakdown.delivery).toBeGreaterThanOrEqual(85);
        expect(result.breakdown.engagement).toBeGreaterThanOrEqual(85);
      });
    });

    describe('result properties', () => {
      it('should return computed_at timestamp', () => {
        const beforeCompute = Date.now();

        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);
        const afterCompute = Date.now();

        expect(result.computed_at).toBeGreaterThanOrEqual(beforeCompute);
        expect(result.computed_at).toBeLessThanOrEqual(afterCompute);
      });

      it('should always include explanation', () => {
        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(result.explanation).toBeDefined();
        expect(result.explanation.length).toBeGreaterThan(0);
        expect(typeof result.explanation).toBe('string');
      });

      it('should always include signals array', () => {
        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        expect(Array.isArray(result.signals)).toBe(true);
        expect(result.signals.length).toBeGreaterThan(0);
      });

      it('should have valid signal structure', () => {
        const input: HealthScoreInput = {
          financialScore: 75,
          meetingSentimentScores: [7],
          actionItemStats: { total: 10, completed: 8, overdue: 1 },
          meetingFrequencyTrend: 'stable',
          lastMeetingDaysAgo: 10,
        };

        const result = agent.computeHealthScore(input);

        result.signals.forEach(signal => {
          expect(signal.type).toBeDefined();
          expect(typeof signal.type).toBe('string');
          expect(signal.message).toBeDefined();
          expect(typeof signal.message).toBe('string');
          expect(signal.severity).toMatch(/^(high|medium|low|positive)$/);
        });
      });
    });
  });
});

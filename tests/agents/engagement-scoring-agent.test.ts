/**
 * Comprehensive tests for the Engagement Scoring Agent
 *
 * Tests cover:
 * 1. Calendar (60%) + Email (40%) weighted scoring
 * 2. High engagement scenarios (frequent meetings, responsive emails)
 * 3. Low engagement scenarios (few meetings, slow replies)
 * 4. Mixed engagement scenarios
 * 5. v1 fallback heuristic (when calendar/email unavailable)
 * 6. Edge cases (no data, partial data, boundary conditions)
 * 7. Score range validation (0-100)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EngagementScoringAgent } from '@/lib/agents/engagement-scoring-agent';
import {
  ClientCalendarMetrics,
  ClientEmailMetrics,
  EngagementScoreInput,
} from '@/types/integrations';

describe('EngagementScoringAgent', () => {
  let agent: EngagementScoringAgent;
  const clientId = 'client-123';
  const agencyId = 'agency-456';

  beforeEach(() => {
    agent = new EngagementScoringAgent();
    // Mock Date.now() for consistent timestamp testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Overall Score Range Validation', () => {
    it('should return overall score in 0-100 range with calendar data only', () => {
      const input: EngagementScoreInput = {
        calendarMetrics: {
          clientId,
          totalMeetings30d: 5,
          totalMeetings60d: 10,
          totalMeetings90d: 15,
          meetingFrequencyTrend: 'stable',
          avgMeetingsPerWeek: 1,
          lastMeetingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          attendeeEngagement: 85,
          cadenceScore: 75,
        },
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
      expect(result.overallEngagementScore).toBeLessThanOrEqual(100);
    });

    it('should return overall score in 0-100 range with email data only', () => {
      const input: EngagementScoreInput = {
        emailMetrics: {
          clientId,
          totalThreads30d: 15,
          totalMessages30d: 45,
          avgResponseTimeHours: 4,
          clientAvgResponseTimeHours: 8,
          responseTimetrend: 'improving',
          volumeTrend: 'stable',
        },
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
      expect(result.overallEngagementScore).toBeLessThanOrEqual(100);
    });

    it('should return overall score in 0-100 range with both calendar and email data', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 4,
        totalMeetings60d: 8,
        totalMeetings90d: 12,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 1,
        lastMeetingDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 80,
        cadenceScore: 70,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 12,
        totalMessages30d: 35,
        avgResponseTimeHours: 6,
        clientAvgResponseTimeHours: 12,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
      expect(result.overallEngagementScore).toBeLessThanOrEqual(100);
    });

    it('should return overall score in 0-100 range with fallback data only', () => {
      const input: EngagementScoreInput = {
        meetingFrequencyTrend: 'stable',
        lastMeetingDaysAgo: 10,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
      expect(result.overallEngagementScore).toBeLessThanOrEqual(100);
    });

    it('should return overall score in 0-100 range with no data', () => {
      const input: EngagementScoreInput = {};

      const result = agent.computeEngagementScore(clientId, agencyId, input);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
      expect(result.overallEngagementScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Calendar and Email Weighting (60% / 40%)', () => {
    it('should apply 60% calendar weight and 40% email weight when both present', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 4,
        totalMeetings60d: 8,
        totalMeetings90d: 12,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 1.2,
        lastMeetingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 100,
        cadenceScore: 100,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 15,
        totalMessages30d: 45,
        avgResponseTimeHours: 2,
        clientAvgResponseTimeHours: 2,
        responseTimetrend: 'improving',
        volumeTrend: 'increasing',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      // Both scores should be high
      expect(result.calendarScore).toBeGreaterThan(70);
      expect(result.emailScore).toBeGreaterThan(70);

      // Overall should be weighted average (60% calendar, 40% email)
      const expectedOverall =
        result.calendarScore * 0.6 + result.emailScore * 0.4;
      expect(result.overallEngagementScore).toBe(Math.round(expectedOverall));
    });

    it('should use 100% calendar weight when only calendar available', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 4,
        totalMeetings60d: 8,
        totalMeetings90d: 12,
        meetingFrequencyTrend: 'increasing',
        avgMeetingsPerWeek: 1,
        lastMeetingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 75,
        cadenceScore: 70,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      // Overall should equal calendar score
      expect(result.overallEngagementScore).toBe(result.calendarScore);
    });

    it('should use 100% email weight when only email available', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 10,
        totalMessages30d: 30,
        avgResponseTimeHours: 8,
        clientAvgResponseTimeHours: 16,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      // Overall should equal email score
      expect(result.overallEngagementScore).toBe(result.emailScore);
    });
  });

  describe('High Engagement Scenarios', () => {
    it('should score high for frequent meetings with recent activity', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 6,
        totalMeetings60d: 12,
        totalMeetings90d: 18,
        meetingFrequencyTrend: 'increasing',
        avgMeetingsPerWeek: 1.5,
        lastMeetingDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 95,
        cadenceScore: 90,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(80);
      expect(result.overallEngagementScore).toBeGreaterThan(80);
    });

    it('should score high for responsive emails with increasing volume', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 20,
        totalMessages30d: 60,
        avgResponseTimeHours: 1,
        clientAvgResponseTimeHours: 2,
        responseTimetrend: 'improving',
        volumeTrend: 'increasing',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.emailScore).toBeGreaterThan(85);
      expect(result.overallEngagementScore).toBeGreaterThan(85);
    });

    it('should score very high for both high calendar and email engagement', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 5,
        totalMeetings60d: 10,
        totalMeetings90d: 15,
        meetingFrequencyTrend: 'increasing',
        avgMeetingsPerWeek: 1.2,
        lastMeetingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 90,
        cadenceScore: 85,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 18,
        totalMessages30d: 54,
        avgResponseTimeHours: 2,
        clientAvgResponseTimeHours: 4,
        responseTimetrend: 'improving',
        volumeTrend: 'increasing',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(75);
      expect(result.emailScore).toBeGreaterThan(75);
      expect(result.overallEngagementScore).toBeGreaterThan(75);
    });
  });

  describe('Low Engagement Scenarios', () => {
    it('should score low for infrequent meetings with old last meeting', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 0,
        totalMeetings60d: 1,
        totalMeetings90d: 2,
        meetingFrequencyTrend: 'declining',
        avgMeetingsPerWeek: 0.02,
        lastMeetingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 20,
        cadenceScore: 15,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(40);
      expect(result.overallEngagementScore).toBeLessThan(40);
    });

    it('should score low for minimal email activity with slow responses', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 1,
        totalMessages30d: 3,
        avgResponseTimeHours: 72,
        clientAvgResponseTimeHours: 120,
        responseTimetrend: 'worsening',
        volumeTrend: 'declining',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.emailScore).toBeLessThan(40);
      expect(result.overallEngagementScore).toBeLessThan(40);
    });

    it('should score low for both low calendar and email engagement', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 0,
        totalMeetings60d: 1,
        totalMeetings90d: 2,
        meetingFrequencyTrend: 'declining',
        avgMeetingsPerWeek: 0.05,
        lastMeetingDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 25,
        cadenceScore: 20,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 2,
        totalMessages30d: 5,
        avgResponseTimeHours: 48,
        clientAvgResponseTimeHours: 96,
        responseTimetrend: 'worsening',
        volumeTrend: 'declining',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(50);
      expect(result.emailScore).toBeLessThan(50);
      expect(result.overallEngagementScore).toBeLessThan(50);
    });
  });

  describe('Mixed Engagement Scenarios', () => {
    it('should balance high calendar with low email engagement', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 5,
        totalMeetings60d: 10,
        totalMeetings90d: 15,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 1.2,
        lastMeetingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 85,
        cadenceScore: 80,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 2,
        totalMessages30d: 6,
        avgResponseTimeHours: 36,
        clientAvgResponseTimeHours: 72,
        responseTimetrend: 'worsening',
        volumeTrend: 'declining',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(60);
      expect(result.emailScore).toBeLessThan(50);
      // Overall should be weighted between them (60% calendar = higher weight)
      expect(result.overallEngagementScore).toBeGreaterThan(
        result.emailScore
      );
      expect(result.overallEngagementScore).toBeLessThan(result.calendarScore);
    });

    it('should balance low calendar with high email engagement', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 1,
        totalMeetings60d: 2,
        totalMeetings90d: 3,
        meetingFrequencyTrend: 'declining',
        avgMeetingsPerWeek: 0.3,
        lastMeetingDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 40,
        cadenceScore: 35,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 18,
        totalMessages30d: 54,
        avgResponseTimeHours: 2,
        clientAvgResponseTimeHours: 4,
        responseTimetrend: 'improving',
        volumeTrend: 'increasing',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(50);
      expect(result.emailScore).toBeGreaterThan(70);
      // Overall should be weighted between them (but calendar has 60% weight)
      expect(result.overallEngagementScore).toBeLessThan(result.emailScore);
      expect(result.overallEngagementScore).toBeGreaterThan(result.calendarScore);
    });
  });

  describe('v1 Fallback Heuristic', () => {
    it('should use fallback when no calendar/email data available', () => {
      const input: EngagementScoreInput = {
        meetingFrequencyTrend: 'stable',
        lastMeetingDaysAgo: 5,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      // Should compute fallback calendar score
      expect(result.calendarScore).toBeGreaterThan(0);
      expect(result.overallEngagementScore).toBe(result.calendarScore);
      expect(result.meetingFrequencyTrend).toBe('stable');
      expect(result.lastMeetingDaysAgo).toBe(5);
    });

    it('should score high for recent meeting with increasing trend in fallback', () => {
      const input: EngagementScoreInput = {
        meetingFrequencyTrend: 'increasing',
        lastMeetingDaysAgo: 3,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(70);
    });

    it('should score low for old meeting with declining trend in fallback', () => {
      const input: EngagementScoreInput = {
        meetingFrequencyTrend: 'declining',
        lastMeetingDaysAgo: 70,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(50);
    });

    it('should handle stable trend with moderate recency in fallback', () => {
      const input: EngagementScoreInput = {
        meetingFrequencyTrend: 'stable',
        lastMeetingDaysAgo: 20,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(30);
      expect(result.calendarScore).toBeLessThan(80);
    });
  });

  describe('Edge Cases: No Data', () => {
    it('should handle completely empty input', () => {
      const input: EngagementScoreInput = {};

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result).toBeDefined();
      expect(result.clientId).toBe(clientId);
      expect(result.agencyId).toBe(agencyId);
      expect(result.overallEngagementScore).toBe(50); // Default fallback score
      expect(result.calendarScore).toBe(50);
      expect(result.emailScore).toBe(50);
    });

    it('should handle missing lastMeetingDate in calendar metrics', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 0,
        totalMeetings60d: 0,
        totalMeetings90d: 0,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0,
        attendeeEngagement: 0,
        cadenceScore: 0,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(50);
      expect(result.lastMeetingDaysAgo).toBe(999);
    });

    it('should handle missing nextScheduledMeeting in calendar metrics', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 2,
        totalMeetings60d: 5,
        totalMeetings90d: 8,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.5,
        lastMeetingDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 70,
        cadenceScore: 65,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.nextMeetingDaysAway).toBeUndefined();
    });
  });

  describe('Edge Cases: Partial Data', () => {
    it('should handle calendar metrics with only email available', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 8,
        totalMessages30d: 24,
        avgResponseTimeHours: 12,
        clientAvgResponseTimeHours: 24,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.overallEngagementScore).toBe(result.emailScore);
      expect(result.meetingFrequency).toBe(0);
      expect(result.attendeeEngagement).toBe(0);
    });

    it('should handle email metrics with only calendar available', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 3,
        totalMeetings60d: 6,
        totalMeetings90d: 9,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.75,
        lastMeetingDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 75,
        cadenceScore: 70,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.overallEngagementScore).toBe(result.calendarScore);
      expect(result.emailScore).toBe(50);
      expect(result.avgResponseTimeHours).toBe(0);
    });

    it('should handle email metrics with missing optional fields', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 5,
        totalMessages30d: 15,
        avgResponseTimeHours: 8,
        clientAvgResponseTimeHours: 16,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.emailScore).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases: Boundary Conditions', () => {
    it('should handle meeting frequency at ideal boundary (0.5-2 meetings/week)', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 2,
        totalMeetings60d: 4,
        totalMeetings90d: 6,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.5, // Lower boundary
        lastMeetingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 80,
        cadenceScore: 75,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(70);
    });

    it('should handle meeting frequency at upper boundary (2-3 meetings/week)', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 8,
        totalMeetings60d: 16,
        totalMeetings90d: 24,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 2.5,
        lastMeetingDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 85,
        cadenceScore: 80,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeGreaterThan(60);
    });

    it('should handle response time at boundary (2 hours = excellent)', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 10,
        totalMessages30d: 30,
        avgResponseTimeHours: 2,
        clientAvgResponseTimeHours: 4,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.emailScore).toBeGreaterThan(70);
    });

    it('should handle zero meetings case gracefully', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 0,
        totalMeetings60d: 0,
        totalMeetings90d: 0,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0,
        attendeeEngagement: 0,
        cadenceScore: 0,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.calendarScore).toBeLessThan(50);
      expect(result.overallEngagementScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle very high meeting frequency (excessive)', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 20,
        totalMeetings60d: 40,
        totalMeetings90d: 60,
        meetingFrequencyTrend: 'increasing',
        avgMeetingsPerWeek: 5,
        lastMeetingDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 90,
        cadenceScore: 85,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      // Very high frequency may or may not be penalized depending on agent logic
      expect(result.calendarScore).toBeLessThanOrEqual(100);
      expect(result.calendarScore).toBeGreaterThan(0);
    });
  });

  describe('Computed Field Validations', () => {
    it('should include all required fields in result', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 3,
        totalMeetings60d: 6,
        totalMeetings90d: 9,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.75,
        lastMeetingDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 75,
        cadenceScore: 70,
      };

      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 10,
        totalMessages30d: 30,
        avgResponseTimeHours: 6,
        clientAvgResponseTimeHours: 12,
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.clientId).toBe(clientId);
      expect(result.agencyId).toBe(agencyId);
      expect(result.calendarScore).toBeDefined();
      expect(result.emailScore).toBeDefined();
      expect(result.overallEngagementScore).toBeDefined();
      expect(result.meetingFrequency).toBeDefined();
      expect(result.meetingFrequencyTrend).toBeDefined();
      expect(result.lastMeetingDaysAgo).toBeDefined();
      expect(result.attendeeEngagement).toBeDefined();
      expect(result.cadenceRegularity).toBeDefined();
      expect(result.emailVolumeTrend).toBeDefined();
      expect(result.avgResponseTimeHours).toBeDefined();
      expect(result.clientResponsiveness).toBeDefined();
      expect(result.computedAt).toBeDefined();
    });

    it('should calculate lastMeetingDaysAgo correctly from calendar date', () => {
      const daysAgo = 7;
      const lastMeetingDate = new Date(
        Date.now() - daysAgo * 24 * 60 * 60 * 1000
      ).toISOString();

      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 2,
        totalMeetings60d: 4,
        totalMeetings90d: 6,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.5,
        lastMeetingDate,
        attendeeEngagement: 70,
        cadenceScore: 65,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.lastMeetingDaysAgo).toBe(daysAgo);
    });

    it('should round scores to nearest integer', () => {
      const calendarMetrics: ClientCalendarMetrics = {
        clientId,
        totalMeetings30d: 3,
        totalMeetings60d: 6,
        totalMeetings90d: 9,
        meetingFrequencyTrend: 'stable',
        avgMeetingsPerWeek: 0.75,
        lastMeetingDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        attendeeEngagement: 77, // Will create decimal scores
        cadenceScore: 72,
      };

      const input: EngagementScoreInput = {
        calendarMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(Number.isInteger(result.calendarScore)).toBe(true);
      expect(Number.isInteger(result.emailScore)).toBe(true);
      expect(Number.isInteger(result.overallEngagementScore)).toBe(true);
    });

    it('should include computedAt timestamp', () => {
      const input: EngagementScoreInput = {};

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.computedAt).toBeDefined();
      expect(() => new Date(result.computedAt)).not.toThrow();
    });
  });

  describe('Client Responsiveness Calculation', () => {
    it('should calculate client responsiveness from email metrics', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 10,
        totalMessages30d: 30,
        avgResponseTimeHours: 6,
        clientAvgResponseTimeHours: 2, // Very responsive client
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.clientResponsiveness).toBeGreaterThan(80);
    });

    it('should score low client responsiveness for slow responses', () => {
      const emailMetrics: ClientEmailMetrics = {
        clientId,
        totalThreads30d: 5,
        totalMessages30d: 15,
        avgResponseTimeHours: 4,
        clientAvgResponseTimeHours: 96, // Slow client response
        responseTimetrend: 'stable',
        volumeTrend: 'stable',
      };

      const input: EngagementScoreInput = {
        emailMetrics,
      };

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.clientResponsiveness).toBeLessThan(50);
    });

    it('should handle zero client responsiveness with no email data', () => {
      const input: EngagementScoreInput = {};

      const result = agent.computeEngagementScore(clientId, agencyId, input);

      expect(result.clientResponsiveness).toBe(0);
    });
  });
});

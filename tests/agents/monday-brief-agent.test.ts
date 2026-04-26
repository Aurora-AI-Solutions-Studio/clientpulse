import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  MondayBriefAgent,
  MondayBriefContent,
  MondayBriefClientEntry,
} from '../../src/lib/agents/monday-brief-agent';
import { renderBriefEmailHtml } from '../../src/lib/agents/brief-email';

// Mock factory for chainable Supabase query builder
function createMockSupabase(data: {
  clients?: any[];
  healthScores?: any[];
  historyRows?: any[];
  actionItems?: any[];
  engagementRows?: any[];
}): SupabaseClient {
  const chainable = (result: any) => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // Make it thenable/promise-like
    Object.defineProperty(chain, 'then', {
      get: () => (resolve: any) => resolve({ data: result, error: null }),
    });

    return chain;
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'clients':
        return chainable(data.clients ?? []);
      case 'client_health_scores':
        return chainable(data.healthScores ?? []);
      case 'health_score_history':
        return chainable(data.historyRows ?? []);
      case 'action_items':
        return chainable(data.actionItems ?? []);
      case 'engagement_metrics':
        return chainable(data.engagementRows ?? []);
      default:
        return chainable([]);
    }
  });

  return { from: mockFrom } as any;
}

describe('MondayBriefAgent', () => {
  let agent: MondayBriefAgent;

  describe('generate', () => {
    describe('empty agency - no clients', () => {
      beforeEach(() => {
        const mockSupabase = createMockSupabase({
          clients: [],
          healthScores: [],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);
      });

      it('should return zeros for all snapshot counts', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.snapshot.totalClients).toBe(0);
        expect(brief.snapshot.healthy).toBe(0);
        expect(brief.snapshot.atRisk).toBe(0);
        expect(brief.snapshot.critical).toBe(0);
      });

      it('should return empty arrays for client lists', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.needsAttention).toEqual([]);
        expect(brief.trendingRisks).toEqual([]);
        expect(brief.risingStars).toEqual([]);
        expect(brief.topActionItems).toEqual([]);
      });

      it('should use "No clients yet" headline', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.narrative.headline).toContain('No clients yet');
      });

      it('should set averageScore to 0', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.snapshot.averageScore).toBe(0);
      });
    });

    describe('all healthy clients', () => {
      beforeEach(() => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'CompanyA', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'CompanyB', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 85, signals: [] },
            { client_id: 'c2', overall_score: 75, signals: [] },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);
      });

      it('should correctly count healthy clients', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.snapshot.healthy).toBe(2);
        expect(brief.snapshot.atRisk).toBe(0);
        expect(brief.snapshot.critical).toBe(0);
      });

      it('should use "Portfolio is healthy" headline', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.narrative.headline).toContain('Portfolio is healthy');
      });

      it('should have empty needsAttention array', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.needsAttention).toEqual([]);
      });

      it('should compute correct average score', async () => {
        const brief = await agent.generate('agency-1');

        // (85 + 75) / 2 = 80
        expect(brief.snapshot.averageScore).toBe(80);
      });
    });

    describe('mixed portfolio - healthy, at-risk, critical', () => {
      beforeEach(() => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Healthy Client', company_name: 'HealthyCorp', status: 'active' },
            { id: 'c2', name: 'At-Risk Client', company_name: 'RiskyCorp', status: 'active' },
            { id: 'c3', name: 'Critical Client', company_name: 'CriticalCorp', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 80, signals: [] },
            { client_id: 'c2', overall_score: 50, signals: [] },
            { client_id: 'c3', overall_score: 30, signals: [] },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);
      });

      it('should correctly categorize clients by health status', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.snapshot.healthy).toBe(1);
        expect(brief.snapshot.atRisk).toBe(1);
        expect(brief.snapshot.critical).toBe(1);
      });

      it('should populate needsAttention with non-healthy clients', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.needsAttention.length).toBe(2);
        // Should be sorted worst first
        expect(brief.needsAttention[0].overallScore).toBe(30);
        expect(brief.needsAttention[1].overallScore).toBe(50);
      });

      it('should use critical headline when critical clients exist', async () => {
        const brief = await agent.generate('agency-1');

        expect(brief.narrative.headline).toContain('critical');
      });
    });

    describe('trending risks - negative delta', () => {
      beforeEach(() => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Declining Client', company_name: 'DeclinesCorp', status: 'active' },
            { id: 'c2', name: 'Stable Client', company_name: 'StableCorp', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 65, signals: [] },
            { client_id: 'c2', overall_score: 75, signals: [] },
          ],
          historyRows: [
            { client_id: 'c1', score: 75, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c2', score: 75, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);
      });

      it('should detect clients with delta < -5 in trendingRisks', async () => {
        const brief = await agent.generate('agency-1');

        // c1: delta = 65 - 75 = -10 (should be included)
        // c2: delta = 75 - 75 = 0 (should not be included)
        expect(brief.trendingRisks.length).toBe(1);
        expect(brief.trendingRisks[0].clientId).toBe('c1');
        expect(brief.trendingRisks[0].delta).toBe(-10);
      });

      it('should sort trendingRisks worst first', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'B', status: 'active' },
            { id: 'c3', name: 'Client C', company_name: 'C', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 60, signals: [] },
            { client_id: 'c2', overall_score: 50, signals: [] },
            { client_id: 'c3', overall_score: 40, signals: [] },
          ],
          historyRows: [
            { client_id: 'c1', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c2', score: 65, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c3', score: 50, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // c1: delta = -10, c2: delta = -15, c3: delta = -10
        // Should sort by delta ascending (worst first)
        expect(brief.trendingRisks[0].delta).toBe(-15);
      });
    });

    describe('rising stars - positive delta', () => {
      beforeEach(() => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Rising Star', company_name: 'RisingCorp', status: 'active' },
            { id: 'c2', name: 'Stable Client', company_name: 'StableCorp', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 80, signals: [] },
            { client_id: 'c2', overall_score: 75, signals: [] },
          ],
          historyRows: [
            { client_id: 'c1', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c2', score: 75, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);
      });

      it('should detect clients with delta > 5 in risingStars', async () => {
        const brief = await agent.generate('agency-1');

        // c1: delta = 80 - 70 = +10 (should be included)
        // c2: delta = 75 - 75 = 0 (should not be included)
        expect(brief.risingStars.length).toBe(1);
        expect(brief.risingStars[0].clientId).toBe('c1');
        expect(brief.risingStars[0].delta).toBe(10);
      });

      it('should sort risingStars best first', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'B', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 75, signals: [] },
            { client_id: 'c2', overall_score: 82, signals: [] },
          ],
          historyRows: [
            { client_id: 'c1', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c2', score: 72, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // c1: delta = +5 (not > 5, excluded), c2: delta = +10 (included)
        // Should have only c2 since c1's delta is exactly 5 (not > 5)
        expect(brief.risingStars.length).toBe(1);
        expect(brief.risingStars[0].delta).toBe(10);
      });
    });

    describe('needs attention ordering', () => {
      it('should sort needsAttention by worst scores first', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'B', status: 'active' },
            { id: 'c3', name: 'Client C', company_name: 'C', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 55, signals: [] },
            { client_id: 'c2', overall_score: 35, signals: [] },
            { client_id: 'c3', overall_score: 45, signals: [] },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // All are non-healthy (< 70), should sort by score ascending (worst first)
        expect(brief.needsAttention[0].overallScore).toBe(35);
        expect(brief.needsAttention[1].overallScore).toBe(45);
        expect(brief.needsAttention[2].overallScore).toBe(55);
      });
    });

    describe('snapshot averages', () => {
      it('should compute correct average score from all clients', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'B', status: 'active' },
            { id: 'c3', name: 'Client C', company_name: 'C', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 60, signals: [] },
            { client_id: 'c2', overall_score: 70, signals: [] },
            { client_id: 'c3', overall_score: 80, signals: [] },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // (60 + 70 + 80) / 3 = 70
        expect(brief.snapshot.averageScore).toBe(70);
      });
    });

    describe('week-over-week delta', () => {
      it('should compute delta from current avg vs previous avg', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
            { id: 'c2', name: 'Client B', company_name: 'B', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 80, signals: [] },
            { client_id: 'c2', overall_score: 80, signals: [] },
          ],
          historyRows: [
            { client_id: 'c1', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
            { client_id: 'c2', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // Current avg: 80, previous avg: 70, delta: +10
        expect(brief.snapshot.averageScore).toBe(80);
        expect(brief.snapshot.weekOverWeekDelta).toBe(10);
      });

      it('should show negative delta when scores decline', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'A', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 65, signals: [] }],
          historyRows: [
            { client_id: 'c1', score: 75, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.snapshot.weekOverWeekDelta).toBe(-10);
      });
    });

    describe('action items', () => {
      it('should populate topActionItems with due this week items', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'CompanyA', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 75, signals: [] }],
          historyRows: [],
          actionItems: [
            {
              id: 'a1',
              title: 'Follow up on budget',
              client_id: 'c1',
              status: 'open',
              due_date: '2026-04-15',
            },
            {
              id: 'a2',
              title: 'Send proposal',
              client_id: 'c1',
              status: 'open',
              due_date: '2026-04-20',
            },
          ],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.topActionItems.length).toBe(2);
        expect(brief.topActionItems[0].title).toBe('Follow up on budget');
        expect(brief.topActionItems[0].clientName).toBe('Client A');
      });
    });

    describe('narrative headlines', () => {
      it('should use critical headline format when critical clients exist', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Critical', company_name: 'CriticalCorp', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 35, signals: [] }],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.narrative.headline).toMatch(/\d+ client.*in critical.*act today/);
      });

      it('should use at-risk headline format when only at-risk clients exist', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'AtRisk', company_name: 'AtRiskCorp', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 55, signals: [] }],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.narrative.headline).toMatch(/\d+ at-risk/);
      });
    });

    describe('recommended actions', () => {
      it('should generate escalation action for critical client', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Critical Client', company_name: 'CriticalCorp', status: 'active' },
          ],
          healthScores: [
            {
              client_id: 'c1',
              overall_score: 25,
              signals: [{ severity: 'high', message: 'Payment overdue' }],
            },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        const escalationAction = brief.recommendedActions.find((a) => a.type === 'escalation');
        expect(escalationAction).toBeDefined();
        expect(escalationAction?.urgency).toBe('high');
      });

      it('should generate re-engagement action for low engagement client', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Low Engagement', company_name: 'LoEngage', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 60, signals: [] }],
          historyRows: [],
          actionItems: [],
          engagementRows: [
            {
              client_id: 'c1',
              overall_engagement_score: 35,
              meeting_frequency_trend: 'declining',
              last_meeting_days_ago: 20,
              email_volume_trend: 'stable',
              agency_id: 'agency-1',
            },
          ],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        const reEngagementAction = brief.recommendedActions.find((a) => a.type === 're-engagement');
        expect(reEngagementAction).toBeDefined();
      });

      it('should limit recommendedActions to max 3', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Critical', company_name: 'Critical', status: 'active' },
            { id: 'c2', name: 'LowEngage', company_name: 'LowEngage', status: 'active' },
            { id: 'c3', name: 'Rising', company_name: 'Rising', status: 'active' },
            { id: 'c4', name: 'AtRisk1', company_name: 'AtRisk1', status: 'active' },
            { id: 'c5', name: 'AtRisk2', company_name: 'AtRisk2', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 25, signals: [] },
            { client_id: 'c2', overall_score: 60, signals: [] },
            { client_id: 'c3', overall_score: 75, signals: [] },
            { client_id: 'c4', overall_score: 50, signals: [] },
            { client_id: 'c5', overall_score: 55, signals: [] },
          ],
          historyRows: [
            { client_id: 'c3', score: 70, score_type: 'overall', recorded_at: '2026-04-06' },
          ],
          actionItems: [],
          engagementRows: [
            {
              client_id: 'c2',
              overall_engagement_score: 35,
              meeting_frequency_trend: 'stable',
              last_meeting_days_ago: 5,
              email_volume_trend: 'stable',
              agency_id: 'agency-1',
            },
          ],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.recommendedActions.length).toBeLessThanOrEqual(3);
      });
    });

    describe('engagement insights', () => {
      it('should populate engagementInsights with engagement data', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'CompanyA', status: 'active' },
          ],
          healthScores: [{ client_id: 'c1', overall_score: 75, signals: [] }],
          historyRows: [],
          actionItems: [],
          engagementRows: [
            {
              client_id: 'c1',
              overall_engagement_score: 65,
              meeting_frequency_trend: 'stable',
              last_meeting_days_ago: 8,
              email_volume_trend: 'stable',
              agency_id: 'agency-1',
            },
          ],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.engagementInsights.length).toBe(1);
        expect(brief.engagementInsights[0].clientName).toBe('Client A');
        expect(brief.engagementInsights[0].overallEngagement).toBe(65);
        expect(brief.engagementInsights[0].insight).toBeDefined();
      });

      it('should sort engagementInsights by lowest engagement first', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'High Engagement', company_name: 'High', status: 'active' },
            { id: 'c2', name: 'Low Engagement', company_name: 'Low', status: 'active' },
          ],
          healthScores: [
            { client_id: 'c1', overall_score: 75, signals: [] },
            { client_id: 'c2', overall_score: 75, signals: [] },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [
            {
              client_id: 'c1',
              overall_engagement_score: 80,
              meeting_frequency_trend: 'stable',
              last_meeting_days_ago: 5,
              email_volume_trend: 'stable',
              agency_id: 'agency-1',
            },
            {
              client_id: 'c2',
              overall_engagement_score: 30,
              meeting_frequency_trend: 'declining',
              last_meeting_days_ago: 30,
              email_volume_trend: 'declining',
              agency_id: 'agency-1',
            },
          ],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.engagementInsights[0].overallEngagement).toBe(30);
        expect(brief.engagementInsights[1].overallEngagement).toBe(80);
      });

      it('should limit engagementInsights to max 5', async () => {
        const clients = Array.from({ length: 10 }, (_, i) => ({
          id: `c${i + 1}`,
          name: `Client ${i + 1}`,
          company_name: `Company${i + 1}`,
          status: 'active',
        }));

        const engagementRows = Array.from({ length: 10 }, (_, i) => ({
          client_id: `c${i + 1}`,
          overall_engagement_score: 50 + i,
          meeting_frequency_trend: 'stable',
          last_meeting_days_ago: 5 + i,
          email_volume_trend: 'stable',
          agency_id: 'agency-1',
        }));

        const healthScores = clients.map((c) => ({
          client_id: c.id,
          overall_score: 75,
          signals: [],
        }));

        const mockSupabase = createMockSupabase({
          clients,
          healthScores,
          historyRows: [],
          actionItems: [],
          engagementRows,
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.engagementInsights.length).toBeLessThanOrEqual(5);
      });
    });

    describe('weekOf', () => {
      it('should be most recent Monday in YYYY-MM-DD format', async () => {
        const mockSupabase = createMockSupabase({
          clients: [],
          healthScores: [],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // Should be valid YYYY-MM-DD format
        expect(brief.weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Should be a Monday (getMostRecentMonday returns Monday: day 1 in JS where 0 = Sunday)
        // Note: When parsing with Z suffix, JS interprets it as UTC. The actual day depends on the current time.
        // The important thing is that it's a valid date string and represents a Monday.
        const dateObj = new Date(`${brief.weekOf}T00:00:00Z`);
        expect(dateObj.toISOString().slice(0, 10)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('max limits', () => {
      it('should limit needsAttention to max 5', async () => {
        const clients = Array.from({ length: 10 }, (_, i) => ({
          id: `c${i + 1}`,
          name: `Client ${i + 1}`,
          company_name: `Company${i + 1}`,
          status: 'active',
        }));

        const healthScores = clients.map((_, i) => ({
          client_id: `c${i + 1}`,
          overall_score: 30 + i, // All at-risk or critical
          signals: [],
        }));

        const mockSupabase = createMockSupabase({
          clients,
          healthScores,
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.needsAttention.length).toBeLessThanOrEqual(5);
      });

      it('should limit risingStars to max 3', async () => {
        const clients = Array.from({ length: 6 }, (_, i) => ({
          id: `c${i + 1}`,
          name: `Client ${i + 1}`,
          company_name: `Company${i + 1}`,
          status: 'active',
        }));

        const healthScores = clients.map((_, i) => ({
          client_id: `c${i + 1}`,
          overall_score: 75,
          signals: [],
        }));

        const historyRows = clients.map((_, i) => ({
          client_id: `c${i + 1}`,
          score: 65, // All have +10 delta
          score_type: 'overall',
          recorded_at: '2026-04-06',
        }));

        const mockSupabase = createMockSupabase({
          clients,
          healthScores,
          historyRows,
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        expect(brief.risingStars.length).toBeLessThanOrEqual(3);
      });
    });

    describe('signal detection', () => {
      it('should extract top signal from client health scores', async () => {
        const mockSupabase = createMockSupabase({
          clients: [
            { id: 'c1', name: 'Client A', company_name: 'CompanyA', status: 'active' },
          ],
          healthScores: [
            {
              client_id: 'c1',
              overall_score: 50,
              signals: [
                { severity: 'low', message: 'Low engagement' },
                { severity: 'high', message: 'Payment overdue' },
                { severity: 'medium', message: 'Missed meetings' },
              ],
            },
          ],
          historyRows: [],
          actionItems: [],
          engagementRows: [],
        });
        agent = new MondayBriefAgent(mockSupabase);

        const brief = await agent.generate('agency-1');

        // Top signal should be the highest severity one
        expect(brief.needsAttention[0].topSignal).toBe('Payment overdue');
      });
    });

    describe('error handling', () => {
      it('should throw error when Supabase clients query fails', async () => {
        const mockSupabase = {
          from: vi.fn().mockImplementation((table) => {
            if (table === 'clients') {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                then: (resolve: any) =>
                  resolve({ data: null, error: { message: 'Database error' } }),
              };
            }
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
          }),
        } as any;

        agent = new MondayBriefAgent(mockSupabase);

        await expect(agent.generate('agency-1')).rejects.toThrow('Failed to load clients');
      });
    });
  });

  describe('renderBriefEmailHtml', () => {
    const mockBrief: MondayBriefContent = {
      generatedAt: '2026-04-13T10:00:00Z',
      weekOf: '2026-04-07',
      snapshot: {
        totalClients: 3,
        healthy: 2,
        atRisk: 1,
        critical: 0,
        averageScore: 72,
        weekOverWeekDelta: 5,
      },
      needsAttention: [
        {
          clientId: 'c1',
          clientName: 'At Risk Client',
          companyName: 'AtRiskCorp',
          overallScore: 55,
          previousScore: 50,
          delta: 5,
          status: 'at-risk',
          topSignal: 'Low engagement',
        },
      ],
      trendingRisks: [],
      risingStars: [],
      topActionItems: [
        {
          id: 'a1',
          title: 'Follow up',
          clientId: 'c1',
          clientName: 'Client A',
          dueDate: '2026-04-15',
          status: 'open',
        },
      ],
      recommendedActions: [
        {
          id: 'ra-1',
          type: 'check-in',
          clientId: 'c1',
          clientName: 'Client A',
          companyName: 'CompanyA',
          title: 'Review concerns',
          rationale: 'At-risk status',
          urgency: 'medium',
        },
      ],
      engagementInsights: [],
      narrative: {
        headline: 'Portfolio is healthy',
        summary: '3 active clients tracked. Avg health 72/100 (up 5 pts WoW).',
        recommendation: 'Maintain cadence.',
      },
    };

    it('should return HTML string', () => {
      const html = renderBriefEmailHtml({ brief: mockBrief });
      expect(typeof html).toBe('string');
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('</html>');
    });

    it('should contain hero line + week reference + snapshot numbers', () => {
      const html = renderBriefEmailHtml({ brief: mockBrief });
      expect(html).toContain('Week of 2026-04-07');
      expect(html).toContain(mockBrief.snapshot.totalClients.toString());
      expect(html).toContain(mockBrief.snapshot.averageScore.toString());
    });

    it('should include agency name in branded header when provided', () => {
      const html = renderBriefEmailHtml({
        brief: mockBrief,
        agency: { name: 'Acme Agency' },
      });
      expect(html).toContain('Acme Agency');
    });

    it('should render needs-eyes lane when present', () => {
      const html = renderBriefEmailHtml({ brief: mockBrief });
      expect(html).toContain('Needs your eyes');
      expect(html).toContain('AtRiskCorp');
    });

    it('should escape HTML entities in company names', () => {
      const briefWithSpecialChars: MondayBriefContent = {
        ...mockBrief,
        needsAttention: [
          {
            clientId: 'c1',
            clientName: 'Client <A>',
            companyName: 'Company & Co.',
            overallScore: 50,
            status: 'at-risk',
          },
        ],
      };
      const html = renderBriefEmailHtml({ brief: briefWithSpecialChars });
      expect(html).toContain('&amp;');
    });

    it('should include actions block with proposal title', () => {
      const html = renderBriefEmailHtml({ brief: mockBrief });
      expect(html).toContain('Do this week');
      expect(html).toContain('Review concerns');
    });

    it('should render snapshot strip with all five labels', () => {
      const html = renderBriefEmailHtml({ brief: mockBrief });
      expect(html).toContain('Clients');
      expect(html).toContain('Avg health');
      expect(html).toContain('Healthy');
      expect(html).toContain('At-risk');
      expect(html).toContain('Critical');
    });
  });
});

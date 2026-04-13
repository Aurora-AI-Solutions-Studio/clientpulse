import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChurnPredictionAgent, ChurnPredictionInput } from '../../src/lib/agents/churn-prediction-agent';
import { ChurnPrediction } from '../../src/types/alerts';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropicClient {
      messages = {
        create: mockCreate,
      };
    },
  };
});

describe('ChurnPredictionAgent', () => {
  let agent: ChurnPredictionAgent;

  // Helper function to create valid mock response
  const createMockResponse = (overrides: Record<string, unknown> = {}) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          churnProbability: 50,
          riskLevel: 'moderate',
          drivingFactors: [
            {
              category: 'financial',
              signal: 'Slow payment history',
              impact: -15,
              details: 'Client has been paying invoices 10-15 days late',
            },
          ],
          suggestedActions: [
            {
              id: 'action_1',
              priority: 'this_week',
              action: 'Follow up on outstanding invoice',
              rationale: 'Establish payment terms clarity',
              type: 'invoice_followup',
            },
          ],
          shouldCreateSavePlan: false,
          ...overrides,
        }),
      },
    ],
  });

  const createLowRiskInput = (): ChurnPredictionInput => ({
    clientId: 'client_123',
    clientName: 'Healthy Corp',
    currentHealthScore: 85,
    healthScoreHistory: [
      { score: 82, date: '2026-04-06' },
      { score: 84, date: '2026-04-09' },
      { score: 85, date: '2026-04-13' },
    ],
    healthBreakdown: {
      financial: 90,
      relationship: 88,
      delivery: 85,
      engagement: 80,
    },
    recentMeetingSentiments: [9, 8, 9, 8, 9],
    actionItemStats: {
      total: 20,
      completed: 19,
      overdue: 0,
    },
    lastMeetingDaysAgo: 5,
    monthlyRetainer: 50000,
    serviceType: 'Premium Managed Services',
    overdueInvoices: 0,
    meetingFrequencyTrend: 'increasing',
  });

  const createHighRiskInput = (): ChurnPredictionInput => ({
    clientId: 'client_456',
    clientName: 'At Risk Inc',
    currentHealthScore: 35,
    healthScoreHistory: [
      { score: 70, date: '2026-03-13' },
      { score: 55, date: '2026-03-27' },
      { score: 35, date: '2026-04-13' },
    ],
    healthBreakdown: {
      financial: 20,
      relationship: 30,
      delivery: 25,
      engagement: 40,
    },
    recentMeetingSentiments: [3, 2, 4, 2, 3],
    actionItemStats: {
      total: 25,
      completed: 8,
      overdue: 12,
    },
    lastMeetingDaysAgo: 60,
    monthlyRetainer: 100000,
    serviceType: 'Enterprise Solutions',
    overdueInvoices: 3,
    meetingFrequencyTrend: 'declining',
  });

  const createModerateRiskInput = (): ChurnPredictionInput => ({
    clientId: 'client_789',
    clientName: 'Medium Risk Ltd',
    currentHealthScore: 55,
    healthScoreHistory: [
      { score: 65, date: '2026-03-27' },
      { score: 60, date: '2026-04-06' },
      { score: 55, date: '2026-04-13' },
    ],
    healthBreakdown: {
      financial: 60,
      relationship: 50,
      delivery: 55,
      engagement: 60,
    },
    recentMeetingSentiments: [6, 5, 6, 5, 6],
    actionItemStats: {
      total: 15,
      completed: 10,
      overdue: 2,
    },
    lastMeetingDaysAgo: 20,
    monthlyRetainer: 75000,
    serviceType: 'Standard Services',
    overdueInvoices: 1,
    meetingFrequencyTrend: 'stable',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ChurnPredictionAgent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create Anthropic client on initialization', () => {
      expect(agent).toBeDefined();
      expect(agent['client']).toBeDefined();
    });
  });

  describe('Low Risk Client - Healthy Metrics', () => {
    it('should predict low churn probability for healthy client', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 15,
          riskLevel: 'low',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(15);
      expect(result.riskLevel).toBe('low');
    });

    it('should return low risk level for healthy metrics', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 12,
          riskLevel: 'low',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.riskLevel).toBe('low');
    });

    it('should not create save plan for low risk client', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 10,
          riskLevel: 'low',
          shouldCreateSavePlan: false,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeUndefined();
      // Should only call API once (no second call for save plan generation)
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should include driving factors for healthy client', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 10,
          riskLevel: 'low',
          drivingFactors: [
            {
              category: 'engagement',
              signal: 'Strong meeting cadence',
              impact: 5,
              details: 'Client meeting frequency is increasing',
            },
          ],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.drivingFactors).toBeDefined();
      expect(result.drivingFactors.length).toBeGreaterThan(0);
    });
  });

  describe('High Risk Client - Critical Metrics', () => {
    it('should predict high churn probability for at-risk client', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 85,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: {
                subject: 'Let\'s talk about your needs',
                body: 'We value your partnership...',
              },
              qbrAgenda: ['Account performance review', 'Roadmap discussion'],
              talkingPoints: ['Recent wins', 'Future opportunities'],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(85);
      expect(result.riskLevel).toBe('critical');
    });

    it('should return critical risk level for poor metrics', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 88,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: { subject: 'Account check-in', body: 'Let\'s connect' },
              qbrAgenda: [],
              talkingPoints: [],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      expect(result.riskLevel).toBe('critical');
    });

    it('should create save plan when churnProbability > 60', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 75,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: {
                subject: 'Let\'s reconnect',
                body: 'We want to ensure your success',
              },
              qbrAgenda: ['Business review', 'Goals alignment'],
              talkingPoints: ['Partnership value', 'Success metrics'],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeDefined();
      expect(result.savePlan?.id).toBeDefined();
      expect(result.savePlan?.clientId).toBe(input.clientId);
    });

    it('should populate save plan with email and agenda', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 70,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: {
                subject: 'Urgent: Account check-in needed',
                body: 'We need to reconnect immediately',
              },
              qbrAgenda: ['Health assessment', 'Roadmap alignment', 'Support review'],
              talkingPoints: ['Partnership concerns', 'Service improvements', 'Investment plans'],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      expect(result.savePlan?.checkInEmail).toBeDefined();
      expect(result.savePlan?.checkInEmail.subject).toBeDefined();
      expect(result.savePlan?.checkInEmail.body).toBeDefined();
      expect(result.savePlan?.qbrAgenda).toBeDefined();
      expect(result.savePlan?.talkingPoints).toBeDefined();
    });
  });

  describe('Moderate Risk Client', () => {
    it('should predict moderate churn probability', async () => {
      const input = createModerateRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 48,
          riskLevel: 'moderate',
          shouldCreateSavePlan: false,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(48);
      expect(result.riskLevel).toBe('moderate');
    });

    it('should not create save plan when churnProbability <= 60', async () => {
      const input = createModerateRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 55,
          riskLevel: 'moderate',
          shouldCreateSavePlan: false,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Parsing', () => {
    it('should correctly map suggested actions from API response', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: [
            {
              id: 'action_qbr_1',
              priority: 'this_week',
              action: 'Schedule QBR meeting',
              rationale: 'Establish strategic alignment',
              type: 'qbr',
            },
            {
              id: 'action_checkin_1',
              priority: 'immediate',
              action: 'Executive touch base',
              rationale: 'Strengthen relationship',
              type: 'check_in',
            },
          ],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions).toHaveLength(2);
      expect(result.suggestedActions[0].action).toBe('Schedule QBR meeting');
      expect(result.suggestedActions[0].type).toBe('qbr');
      expect(result.suggestedActions[1].priority).toBe('immediate');
    });

    it('should correctly map driving factors from API response', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          drivingFactors: [
            {
              category: 'financial',
              signal: 'Consistent payments',
              impact: 5,
              details: 'Invoice payments are on time',
            },
            {
              category: 'engagement',
              signal: 'High meeting attendance',
              impact: 8,
              details: 'Leadership attends all meetings',
            },
          ],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.drivingFactors).toHaveLength(2);
      expect(result.drivingFactors[0].category).toBe('financial');
      expect(result.drivingFactors[1].category).toBe('engagement');
    });

    it('should generate default IDs for actions without them', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: [
            {
              id: undefined,
              priority: 'this_week',
              action: 'Some action',
              rationale: 'Some reason',
              type: 'check_in',
            },
          ],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions[0].id).toBeDefined();
      expect(result.suggestedActions[0].id).toMatch(/^action_/);
    });

    it('should use provided defaults for missing action fields', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: [
            {
              id: 'action_1',
              priority: undefined,
              action: 'Test action',
              rationale: 'Test rationale',
              type: undefined,
            },
          ],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions[0].priority).toBe('this_week');
      expect(result.suggestedActions[0].type).toBe('check_in');
    });
  });

  describe('Churn Probability Clamping', () => {
    it('should clamp probability to 100 when API returns > 100', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 150,
          riskLevel: 'critical',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(100);
    });

    it('should clamp probability to 0 when API returns < 0', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: -25,
          riskLevel: 'low',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(0);
    });

    it('should keep probability unchanged when in valid range', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 55,
          riskLevel: 'moderate',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(55);
    });

    it('should clamp probability at lower boundary (0)', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 0,
          riskLevel: 'low',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(0);
    });

    it('should clamp probability at upper boundary (100)', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 100,
          riskLevel: 'critical',
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(100);
    });
  });

  describe('Save Plan Generation', () => {
    it('should generate save plan when shouldCreateSavePlan=true AND churnProbability > 60', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 65,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: {
                subject: 'Account retention check-in',
                body: 'We value your partnership...',
              },
              qbrAgenda: ['Strategic review'],
              talkingPoints: ['Success metrics'],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should NOT generate save plan when churnProbability <= 60 even if shouldCreateSavePlan=true', async () => {
      const input = createModerateRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 60,
          riskLevel: 'high',
          shouldCreateSavePlan: true,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should NOT generate save plan when churnProbability > 60 but shouldCreateSavePlan=false', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 70,
          riskLevel: 'critical',
          shouldCreateSavePlan: false,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should generate basic save plan on save plan API error', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 75,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockRejectedValueOnce(new Error('API error on save plan'));

      const result = await agent.predictChurn(input);

      expect(result.savePlan).toBeDefined();
      expect(result.savePlan?.checkInEmail).toBeDefined();
      expect(result.savePlan?.qbrAgenda).toBeDefined();
      expect(result.savePlan?.talkingPoints).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw with "Failed to predict churn" when API throws', async () => {
      const input = createLowRiskInput();
      mockCreate.mockRejectedValueOnce(new Error('API connection error'));

      await expect(agent.predictChurn(input)).rejects.toThrow('Failed to predict churn');
    });

    it('should include original error message in thrown error', async () => {
      const input = createLowRiskInput();
      const originalError = new Error('Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(originalError);

      await expect(agent.predictChurn(input)).rejects.toThrow('Failed to predict churn: Rate limit exceeded');
    });

    it('should throw when API returns invalid JSON', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'This is not valid JSON {invalid}',
          },
        ],
      });

      await expect(agent.predictChurn(input)).rejects.toThrow('Failed to predict churn');
    });

    it('should throw on non-Error rejection', async () => {
      const input = createLowRiskInput();
      mockCreate.mockRejectedValueOnce('Unknown error string');

      await expect(agent.predictChurn(input)).rejects.toThrow('Failed to predict churn: Unknown error');
    });

    it('should handle missing text in API response gracefully', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '',
          },
        ],
      });

      await expect(agent.predictChurn(input)).rejects.toThrow('Failed to predict churn');
    });
  });

  describe('Empty and Missing Fields', () => {
    it('should provide defaults for missing driving factors', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          drivingFactors: undefined,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.drivingFactors).toEqual([]);
    });

    it('should provide defaults for missing suggested actions', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: undefined,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions).toEqual([]);
    });

    it('should use moderate as default riskLevel when missing', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          riskLevel: undefined,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.riskLevel).toBe('moderate');
    });

    it('should use 0 as default churnProbability when missing', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: undefined,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.churnProbability).toBe(0);
    });

    it('should preserve empty suggested actions array', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: [],
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions).toEqual([]);
    });
  });

  describe('Prompt Construction and Input Inclusion', () => {
    it('should include client name in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(input.clientName);
    });

    it('should include health scores in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(String(input.currentHealthScore));
    });

    it('should include monthly retainer in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(String(input.monthlyRetainer));
    });

    it('should include service type in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(input.serviceType);
    });

    it('should include health breakdown scores in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      const content = callArgs.messages[0].content;
      expect(content).toContain(String(input.healthBreakdown.financial));
      expect(content).toContain(String(input.healthBreakdown.relationship));
      expect(content).toContain(String(input.healthBreakdown.delivery));
      expect(content).toContain(String(input.healthBreakdown.engagement));
    });

    it('should include meeting sentiments in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(input.recentMeetingSentiments.join(', '));
    });

    it('should include action item stats in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      const content = callArgs.messages[0].content;
      expect(content).toContain(String(input.actionItemStats.total));
      expect(content).toContain(String(input.actionItemStats.completed));
      expect(content).toContain(String(input.actionItemStats.overdue));
    });

    it('should include client ID in the API call', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      await agent.predictChurn(input);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(input.clientId);
    });
  });

  describe('Response Structure', () => {
    it('should return ChurnPrediction with all required fields', async () => {
      const input = createLowRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      const result = await agent.predictChurn(input);

      expect(result.clientId).toBe(input.clientId);
      expect(result.clientName).toBe(input.clientName);
      expect(typeof result.churnProbability).toBe('number');
      expect(['critical', 'high', 'moderate', 'low']).toContain(result.riskLevel);
      expect(Array.isArray(result.drivingFactors)).toBe(true);
      expect(Array.isArray(result.suggestedActions)).toBe(true);
      expect(result.computedAt).toBeDefined();
    });

    it('should include computedAt timestamp in ISO format', async () => {
      const input = createLowRiskInput();
      const beforeCall = new Date();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      const result = await agent.predictChurn(input);
      const afterCall = new Date();

      expect(result.computedAt).toBeDefined();
      const computedDate = new Date(result.computedAt);
      expect(computedDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(computedDate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should preserve client metadata in response', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(createMockResponse());

      const result = await agent.predictChurn(input);

      expect(result.clientId).toBe(input.clientId);
      expect(result.clientName).toBe(input.clientName);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle churnProbability at exact threshold of 60', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 60,
          riskLevel: 'high',
          shouldCreateSavePlan: true,
        })
      );

      const result = await agent.predictChurn(input);

      // At 60, should NOT create save plan (requires > 60)
      expect(result.savePlan).toBeUndefined();
    });

    it('should handle churnProbability just above threshold of 60', async () => {
      const input = createHighRiskInput();
      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          churnProbability: 60.1,
          riskLevel: 'critical',
          shouldCreateSavePlan: true,
        })
      );
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checkInEmail: { subject: 'Test', body: 'Test body' },
              qbrAgenda: [],
              talkingPoints: [],
            }),
          },
        ],
      });

      const result = await agent.predictChurn(input);

      // Just above 60, should create save plan
      expect(result.savePlan).toBeDefined();
    });

    it('should handle multiple suggested actions', async () => {
      const input = createHighRiskInput();
      const actions = Array.from({ length: 5 }, (_, i) => ({
        id: `action_${i + 1}`,
        priority: 'immediate',
        action: `Action ${i + 1}`,
        rationale: `Reason ${i + 1}`,
        type: 'check_in',
      }));

      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          suggestedActions: actions,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.suggestedActions).toHaveLength(5);
    });

    it('should handle multiple driving factors', async () => {
      const input = createHighRiskInput();
      const factors = Array.from({ length: 4 }, (_, i) => ({
        category: ['financial', 'relationship', 'delivery', 'engagement'][i],
        signal: `Signal ${i + 1}`,
        impact: -(i + 1) * 5,
        details: `Details ${i + 1}`,
      }));

      mockCreate.mockResolvedValueOnce(
        createMockResponse({
          drivingFactors: factors,
        })
      );

      const result = await agent.predictChurn(input);

      expect(result.drivingFactors).toHaveLength(4);
    });
  });
});

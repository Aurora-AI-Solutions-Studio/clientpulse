import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MeetingIntelligenceAgent, MeetingIntelligenceResult } from '../../src/lib/agents/meeting-intelligence-agent';

// Sprint 8A M1.1: agents now call `generateCompletionWithRetry()`
// from `@/lib/llm/retry`. The shim below translates the new arg/response
// shape to the legacy Anthropic shape so existing tests keep working
// without rewriting every assertion:
//   - the shim calls `mockCreate(anthropicArgs)` so test-level
//     `mockCreate.mock.calls[0][0].messages` still works
//   - when `mockCreate` returns `{content:[{type:'text', text}]}`, the
//     shim converts it to `{text, ...}` as the agent expects
//   - when `mockCreate` rejects, the shim rejects too
const mockCreate = vi.fn();
vi.mock('@/lib/llm/retry', () => ({
  generateCompletionWithRetry: async (args: {
    plan: string;
    request: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: string; content: string }>;
    };
  }) => {
    const resp = await mockCreate({
      model: args.request.model,
      max_tokens: args.request.max_tokens,
      system: args.request.system,
      messages: args.request.messages,
    });
    const firstText = Array.isArray(resp?.content)
      ? resp.content.find((b: { type: string }) => b.type === 'text')
      : undefined;
    const text = firstText && firstText.type === 'text' ? firstText.text : '';
    return {
      text,
      model: args.request.model,
      provider: 'anthropic',
      usage: { input_tokens: 0, output_tokens: 0 },
      stop_reason: 'end_turn',
      routed: false,
    };
  },
}));

describe('MeetingIntelligenceAgent', () => {
  let agent: MeetingIntelligenceAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new MeetingIntelligenceAgent();
  });

  describe('positive meeting scenario', () => {
    it('should extract high sentiment with positive indicators', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 9,
              action_items: [
                {
                  title: 'Implement new feature',
                  assignee: 'John Doe',
                  deadline: '2026-04-30',
                },
              ],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['John', 'Jane', 'Bob'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Highly productive meeting with clear outcomes.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'We discussed the new feature and everyone agreed.',
        'Acme Corp'
      );

      expect(result.sentiment_score).toBe(9);
      expect(result.action_items.length).toBe(1);
      expect(result.action_items[0].title).toBe('Implement new feature');
      expect(result.escalation_signals.length).toBe(0);
      expect(result.summary).toBe('Highly productive meeting with clear outcomes.');
    });

    it('should have decision makers present flag set correctly', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 8,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['CFO', 'CEO', 'CTO'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Great alignment with leadership.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Meeting with executive team',
        'Tech Startup'
      );

      expect(result.stakeholder_engagement.decision_makers_present).toBe(true);
      expect(result.stakeholder_engagement.attendees).toContain('CFO');
    });
  });

  describe('negative meeting scenario', () => {
    it('should extract low sentiment with escalation signals', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 2,
              action_items: [
                {
                  title: 'Fix critical bug',
                  assignee: 'Dev Team',
                  deadline: null,
                },
              ],
              scope_changes: [
                {
                  description: 'Project scope increased by 40%',
                  impact: 'Schedule delayed by 2 months',
                },
              ],
              stakeholder_engagement: {
                attendees: ['Manager', 'Client'],
                decision_makers_present: true,
                engagement_level: 'low',
              },
              escalation_signals: [
                {
                  signal: 'Client expressed dissatisfaction',
                  severity: 'high',
                },
                {
                  signal: 'Missed deliverable deadline',
                  severity: 'high',
                },
              ],
              upsell_mentions: [],
              summary: 'Difficult meeting with serious concerns raised.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Client unhappy with delivery',
        'Frustrated Client Inc'
      );

      expect(result.sentiment_score).toBe(2);
      expect(result.escalation_signals.length).toBe(2);
      expect(result.escalation_signals[0].severity).toBe('high');
      expect(result.scope_changes.length).toBe(1);
      expect(result.scope_changes[0].impact).toContain('delayed');
    });

    it('should capture multiple escalation signals with varying severities', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 3,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['VP Sales', 'Account Manager'],
                decision_makers_present: true,
                engagement_level: 'medium',
              },
              escalation_signals: [
                {
                  signal: 'Budget concerns mentioned',
                  severity: 'high',
                },
                {
                  signal: 'Contract renewal in jeopardy',
                  severity: 'high',
                },
                {
                  signal: 'Competitor evaluation underway',
                  severity: 'medium',
                },
              ],
              upsell_mentions: [],
              summary: 'Meeting revealed multiple business risks.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Discussion about account health',
        'At-Risk Client'
      );

      expect(result.escalation_signals.length).toBe(3);
      const highSeverity = result.escalation_signals.filter(
        (s) => s.severity === 'high'
      );
      const mediumSeverity = result.escalation_signals.filter(
        (s) => s.severity === 'medium'
      );
      expect(highSeverity.length).toBe(2);
      expect(mediumSeverity.length).toBe(1);
    });
  });

  describe('upsell mention extraction', () => {
    it('should capture upsell mentions with estimated values', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 8,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Buyer', 'Seller'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [
                {
                  mention: 'Interest in premium tier',
                  estimated_value: 50000,
                  context: 'Client mentioned scaling needs',
                },
                {
                  mention: 'Add-on service inquiry',
                  estimated_value: 15000,
                  context: 'Discussion about advanced analytics',
                },
              ],
              summary: 'Strong upsell opportunities identified.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Meeting about expansion',
        'Growth Client'
      );

      expect(result.upsell_mentions.length).toBe(2);
      expect(result.upsell_mentions[0].mention).toBe('Interest in premium tier');
      expect(result.upsell_mentions[0].estimated_value).toBe(50000);
      expect(result.upsell_mentions[1].estimated_value).toBe(15000);
    });

    it('should handle upsell mentions with null estimated values', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Sales Rep', 'Client'],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [
                {
                  mention: 'Mentioned interest in feature X',
                  estimated_value: null,
                  context: 'Casual discussion, no pricing talked',
                },
              ],
              summary: 'Potential opportunity identified.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Feature discussion',
        'Prospect ABC'
      );

      expect(result.upsell_mentions.length).toBe(1);
      expect(result.upsell_mentions[0].estimated_value).toBeNull();
      expect(result.upsell_mentions[0].context).toContain('Casual');
    });
  });

  describe('action item extraction', () => {
    it('should extract multiple action items with assignees and deadlines', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [
                {
                  title: 'Send proposal',
                  assignee: 'Sales Team',
                  deadline: '2026-04-15',
                },
                {
                  title: 'Schedule follow-up',
                  assignee: 'Account Manager',
                  deadline: '2026-04-20',
                },
                {
                  title: 'Prepare presentation',
                  assignee: 'Marketing',
                  deadline: '2026-04-22',
                },
              ],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Team A', 'Team B'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Clear action items defined.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Action planning meeting',
        'Client XYZ'
      );

      expect(result.action_items.length).toBe(3);
      expect(result.action_items[0].title).toBe('Send proposal');
      expect(result.action_items[0].assignee).toBe('Sales Team');
      expect(result.action_items[0].deadline).toBe('2026-04-15');
      expect(result.action_items[2].deadline).toBe('2026-04-22');
    });

    it('should handle action items with TBD assignees', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 6,
              action_items: [
                {
                  title: 'Investigate issue',
                  assignee: 'TBD',
                  deadline: null,
                },
              ],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Engineer'],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Investigation needed.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Technical discussion',
        'Tech Partner'
      );

      expect(result.action_items.length).toBe(1);
      expect(result.action_items[0].assignee).toBe('TBD');
      expect(result.action_items[0].deadline).toBeNull();
    });
  });

  describe('stakeholder engagement', () => {
    it('should capture high engagement with decision makers', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 8,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['CEO', 'CFO', 'COO', 'VP Engineering'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Excellent executive engagement.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Executive strategy session',
        'Enterprise Client'
      );

      expect(result.stakeholder_engagement.attendees.length).toBe(4);
      expect(result.stakeholder_engagement.decision_makers_present).toBe(true);
      expect(result.stakeholder_engagement.engagement_level).toBe('high');
    });

    it('should handle medium engagement level', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 6,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Manager', 'Coordinator'],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Standard engagement level.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Regular check-in',
        'Regular Client'
      );

      expect(result.stakeholder_engagement.engagement_level).toBe('medium');
      expect(result.stakeholder_engagement.decision_makers_present).toBe(false);
    });
  });

  describe('empty transcript handling', () => {
    it('should work with empty transcript string', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 5,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'No transcript provided.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence('', 'Some Client');

      expect(result).toBeDefined();
      expect(result.sentiment_score).toBe(5);
      expect(Array.isArray(result.action_items)).toBe(true);
    });
  });

  describe('default values', () => {
    it('should apply sentiment score default of 5 when missing', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      expect(result.sentiment_score).toBe(5);
    });

    it('should apply empty array defaults for missing fields', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              summary: 'Brief summary',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      expect(Array.isArray(result.action_items)).toBe(true);
      expect(result.action_items.length).toBe(0);
      expect(Array.isArray(result.scope_changes)).toBe(true);
      expect(result.scope_changes.length).toBe(0);
      expect(Array.isArray(result.escalation_signals)).toBe(true);
      expect(result.escalation_signals.length).toBe(0);
      expect(Array.isArray(result.upsell_mentions)).toBe(true);
      expect(result.upsell_mentions.length).toBe(0);
    });

    it('should apply stakeholder engagement defaults when missing', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [],
              scope_changes: [],
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      expect(result.stakeholder_engagement).toBeDefined();
      expect(result.stakeholder_engagement.attendees).toEqual([]);
      expect(result.stakeholder_engagement.decision_makers_present).toBe(false);
      expect(result.stakeholder_engagement.engagement_level).toBe('medium');
    });

    it('should apply summary default when missing', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      expect(result.summary).toBe('Meeting analysis complete.');
    });
  });

  describe('sentiment score range', () => {
    it('should handle sentiment score of 1 (minimum)', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 1,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'low',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Very negative.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Bad meeting',
        'Client'
      );

      expect(result.sentiment_score).toBe(1);
    });

    it('should handle sentiment score of 10 (maximum)', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 10,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Excellent meeting.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Great meeting',
        'Client'
      );

      expect(result.sentiment_score).toBe(10);
    });

    it('should preserve all sentiment scores in 1-10 range', async () => {
      for (let score = 1; score <= 10; score++) {
        vi.clearAllMocks();
        const mockResponse = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sentiment_score: score,
                action_items: [],
                scope_changes: [],
                stakeholder_engagement: {
                  attendees: [],
                  decision_makers_present: false,
                  engagement_level: 'medium',
                },
                escalation_signals: [],
                upsell_mentions: [],
                summary: `Score ${score}`,
              }),
            },
          ],
        };

        mockCreate.mockResolvedValueOnce(mockResponse);

        const result = await agent.extractMeetingIntelligence(
          'Transcript',
          'Client'
        );

        expect(result.sentiment_score).toBe(score);
      }
    });
  });

  describe('extracted_at timestamp', () => {
    it('should set extracted_at to recent timestamp', async () => {
      const beforeCall = Date.now();

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      const afterCall = Date.now();

      expect(result.extracted_at).toBeGreaterThanOrEqual(beforeCall);
      expect(result.extracted_at).toBeLessThanOrEqual(afterCall + 1000); // Allow small margin
    });

    it('should have extracted_at as numeric timestamp', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 5,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Transcript',
        'Client'
      );

      expect(typeof result.extracted_at).toBe('number');
      expect(result.extracted_at).toBeGreaterThan(0);
    });
  });

  describe('API error handling', () => {
    it('should throw with proper error message on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API request failed'));

      await expect(
        agent.extractMeetingIntelligence('Transcript', 'Client')
      ).rejects.toThrow('Failed to extract meeting intelligence: API request failed');
    });

    it('should throw with default message for non-Error objects', async () => {
      mockCreate.mockRejectedValueOnce('Unknown error');

      await expect(
        agent.extractMeetingIntelligence('Transcript', 'Client')
      ).rejects.toThrow('Failed to extract meeting intelligence: Unknown error');
    });

    it('should include original error details in thrown error', async () => {
      const originalError = new Error('Network timeout');
      mockCreate.mockRejectedValueOnce(originalError);

      try {
        await agent.extractMeetingIntelligence('Transcript', 'Client');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network timeout');
      }
    });
  });

  describe('JSON parse error handling', () => {
    it('should throw on invalid JSON response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'This is not valid JSON {broken',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(
        agent.extractMeetingIntelligence('Transcript', 'Client')
      ).rejects.toThrow('Failed to extract meeting intelligence');
    });

    it('should throw on malformed JSON with helpful context', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '{"sentiment_score": 5, invalid}',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await expect(
        agent.extractMeetingIntelligence('Transcript', 'Client')
      ).rejects.toThrow();
    });
  });

  describe('prompt construction', () => {
    it('should include client name in prompt', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 5,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const clientName = 'Acme Corporation';
      await agent.extractMeetingIntelligence('Transcript text', clientName);

      // Verify the prompt was called and check the first argument
      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(clientName);
    });

    it('should include transcript in prompt', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 5,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const transcript = 'This is my meeting transcript with specific content';
      await agent.extractMeetingIntelligence(transcript, 'Client');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(transcript);
    });

    it('should use correct model and max tokens', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 5,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await agent.extractMeetingIntelligence('Transcript', 'Client');

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      // Sprint 8A M1.1: agents now request `claude-sonnet-4-5` as the
      // logical model ID; the multi-model router maps it to the
      // vendor model string before calling the provider.
      expect(callArgs.model).toBe('claude-sonnet-4-5');
      expect(callArgs.max_tokens).toBe(2000);
    });
  });

  describe('scope change detection', () => {
    it('should properly parse scope changes', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 6,
              action_items: [],
              scope_changes: [
                {
                  description: 'Added three new modules',
                  impact: 'Timeline extended by 3 weeks',
                },
                {
                  description: 'Requirement for additional integrations',
                  impact: 'Budget increase of 25%',
                },
              ],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'medium',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'Scope changes discussed.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Project scope discussion',
        'Client'
      );

      expect(result.scope_changes.length).toBe(2);
      expect(result.scope_changes[0].description).toBe('Added three new modules');
      expect(result.scope_changes[0].impact).toContain('Timeline');
      expect(result.scope_changes[1].impact).toContain('Budget');
    });

    it('should handle empty scope changes array', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 8,
              action_items: [],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: [],
                decision_makers_present: false,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [],
              summary: 'No scope changes.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Stable project discussion',
        'Client'
      );

      expect(result.scope_changes.length).toBe(0);
      expect(Array.isArray(result.scope_changes)).toBe(true);
    });
  });

  describe('comprehensive meeting result structure', () => {
    it('should return complete MeetingIntelligenceResult structure', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sentiment_score: 7,
              action_items: [
                {
                  title: 'Prepare docs',
                  assignee: 'Sarah',
                  deadline: '2026-04-25',
                },
              ],
              scope_changes: [],
              stakeholder_engagement: {
                attendees: ['Alice', 'Bob'],
                decision_makers_present: true,
                engagement_level: 'high',
              },
              escalation_signals: [],
              upsell_mentions: [
                {
                  mention: 'Premium features',
                  estimated_value: 25000,
                  context: 'Discussed scaling',
                },
              ],
              summary: 'Productive meeting.',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await agent.extractMeetingIntelligence(
        'Complete meeting transcript',
        'Full Client'
      );

      // Verify all fields exist
      expect(result.sentiment_score).toBeDefined();
      expect(result.action_items).toBeDefined();
      expect(result.scope_changes).toBeDefined();
      expect(result.stakeholder_engagement).toBeDefined();
      expect(result.escalation_signals).toBeDefined();
      expect(result.upsell_mentions).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.extracted_at).toBeDefined();

      // Verify types
      expect(typeof result.sentiment_score).toBe('number');
      expect(Array.isArray(result.action_items)).toBe(true);
      expect(Array.isArray(result.scope_changes)).toBe(true);
      expect(typeof result.stakeholder_engagement).toBe('object');
      expect(Array.isArray(result.escalation_signals)).toBe(true);
      expect(Array.isArray(result.upsell_mentions)).toBe(true);
      expect(typeof result.summary).toBe('string');
      expect(typeof result.extracted_at).toBe('number');
    });
  });
});

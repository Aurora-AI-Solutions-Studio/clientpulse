/**
 * Comprehensive tests for the Suggested Actions Agent
 *
 * Tests cover:
 * 1. Action generation for high-risk clients
 * 2. Correct ID format (action_clientId_index)
 * 3. Priority field validation and enum values
 * 4. Action type field validation and enum values
 * 5. Priority sorting: immediate > this_week > this_month
 * 6. Prioritized actions method sorting behavior
 * 7. Rationale field presence and content
 * 8. API errors, JSON parsing, non-array responses
 * 9. Default values for missing fields
 * 10. Prompt content validation (churn probability, health scores, factors)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SuggestedActionsAgent,
  SuggestedActionsInput,
} from '../../src/lib/agents/suggested-actions-agent';

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
});

describe('SuggestedActionsAgent', () => {
  let agent: SuggestedActionsAgent;

  const defaultInput: SuggestedActionsInput = {
    clientId: 'client-456',
    clientName: 'TechStartup Inc',
    churnProbability: 75,
    churnFactors: [
      {
        category: 'financial',
        signal: 'Invoice payment 30 days late',
        details: 'Last 2 payments delayed, cash flow concerns mentioned',
      },
      {
        category: 'relationship',
        signal: 'Decreased stakeholder engagement',
        details: 'Meeting attendance down 50%, only attending CEO now',
      },
    ],
    currentHealthScore: 35,
    healthBreakdown: {
      financial: 25,
      relationship: 40,
      delivery: 45,
      engagement: 20,
    },
    lastMeetingDaysAgo: 45,
    serviceType: 'Premium SaaS',
    monthlyRetainer: 8000,
  };

  beforeEach(() => {
    agent = new SuggestedActionsAgent();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Action Generation Tests
  // ============================================================================

  describe('generateActions', () => {
    it('should generate actions for high-risk client', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Call CFO to discuss payment status and address cash flow concerns',
                rationale: 'Invoice delays indicate financial strain; immediate contact needed',
                type: 'invoice_followup',
              },
              {
                priority: 'this_week',
                action: 'Schedule executive QBR with CEO and finance leadership',
                rationale: 'Relationship weakness requires high-level engagement to rebuild trust',
                type: 'qbr',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('Call CFO to discuss payment status and address cash flow concerns');
      expect(result[1].action).toBe('Schedule executive QBR with CEO and finance leadership');
    });

    it('should generate multiple actions (3-6)', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action 1',
                rationale: 'Rationale 1',
                type: 'invoice_followup',
              },
              {
                priority: 'this_week',
                action: 'Action 2',
                rationale: 'Rationale 2',
                type: 'qbr',
              },
              {
                priority: 'this_month',
                action: 'Action 3',
                rationale: 'Rationale 3',
                type: 'check_in',
              },
              {
                priority: 'immediate',
                action: 'Action 4',
                rationale: 'Rationale 4',
                type: 'escalation',
              },
              {
                priority: 'this_week',
                action: 'Action 5',
                rationale: 'Rationale 5',
                type: 'service_review',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toHaveLength(5);
      expect(result.every((action) => action.id)).toBe(true);
    });
  });

  // ============================================================================
  // ID Format Tests
  // ============================================================================

  describe('ID Format: action_clientId_index', () => {
    it('should generate IDs with correct format', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action 1',
                rationale: 'Reason 1',
                type: 'check_in',
              },
              {
                priority: 'this_week',
                action: 'Action 2',
                rationale: 'Reason 2',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].id).toBe('action_client-456_0');
      expect(result[1].id).toBe('action_client-456_1');
    });

    it('should include clientId in generated IDs', async () => {
      const input: SuggestedActionsInput = {
        ...defaultInput,
        clientId: 'special-client-xyz',
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Test action',
                rationale: 'Test rationale',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(input);

      expect(result[0].id).toMatch(/^action_special-client-xyz_\d+$/);
    });

    it('should use zero-based index for first action', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'First action',
                rationale: 'First rationale',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].id).toContain('_0');
    });

    it('should increment index for each action', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action 1',
                rationale: 'Rationale 1',
                type: 'check_in',
              },
              {
                priority: 'this_week',
                action: 'Action 2',
                rationale: 'Rationale 2',
                type: 'check_in',
              },
              {
                priority: 'this_month',
                action: 'Action 3',
                rationale: 'Rationale 3',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].id).toContain('_0');
      expect(result[1].id).toContain('_1');
      expect(result[2].id).toContain('_2');
    });
  });

  // ============================================================================
  // Priority Field Tests
  // ============================================================================

  describe('Priority Field Validation', () => {
    it('should have valid priority values', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action 1',
                rationale: 'Rationale 1',
                type: 'check_in',
              },
              {
                priority: 'this_week',
                action: 'Action 2',
                rationale: 'Rationale 2',
                type: 'check_in',
              },
              {
                priority: 'this_month',
                action: 'Action 3',
                rationale: 'Rationale 3',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(['immediate', 'this_week', 'this_month']).toContain(result[0].priority);
      expect(['immediate', 'this_week', 'this_month']).toContain(result[1].priority);
      expect(['immediate', 'this_week', 'this_month']).toContain(result[2].priority);
    });

    it('should default to this_week when priority is missing', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                // priority intentionally omitted
                action: 'Action without priority',
                rationale: 'Rationale',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].priority).toBe('this_week');
    });

    it('should handle all three priority levels', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Critical action',
                rationale: 'Very urgent',
                type: 'escalation',
              },
              {
                priority: 'this_week',
                action: 'Weekly action',
                rationale: 'Should be done soon',
                type: 'check_in',
              },
              {
                priority: 'this_month',
                action: 'Monthly action',
                rationale: 'Can be scheduled',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result.map((a) => a.priority)).toEqual(['immediate', 'this_week', 'this_month']);
    });
  });

  // ============================================================================
  // Type Field Tests
  // ============================================================================

  describe('Type Field Validation', () => {
    it('should have valid action type values', async () => {
      const validTypes = ['qbr', 'check_in', 'invoice_followup', 'stakeholder_reengagement', 'service_review', 'escalation'];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'QBR',
                rationale: 'Annual review',
                type: 'qbr',
              },
              {
                priority: 'this_week',
                action: 'Check in',
                rationale: 'Touchpoint',
                type: 'check_in',
              },
              {
                priority: 'immediate',
                action: 'Invoice',
                rationale: 'Payment',
                type: 'invoice_followup',
              },
              {
                priority: 'this_week',
                action: 'Reengagement',
                rationale: 'Lost contact',
                type: 'stakeholder_reengagement',
              },
              {
                priority: 'this_month',
                action: 'Service',
                rationale: 'Review delivery',
                type: 'service_review',
              },
              {
                priority: 'immediate',
                action: 'Escalate',
                rationale: 'Critical issue',
                type: 'escalation',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      result.forEach((action) => {
        expect(validTypes).toContain(action.type);
      });
    });

    it('should default to check_in when type is missing', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action without type',
                rationale: 'Rationale',
                // type intentionally omitted
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].type).toBe('check_in');
    });

    it('should handle all valid action types', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { priority: 'immediate', action: 'A1', rationale: 'R1', type: 'qbr' },
              { priority: 'this_week', action: 'A2', rationale: 'R2', type: 'check_in' },
              { priority: 'immediate', action: 'A3', rationale: 'R3', type: 'invoice_followup' },
              { priority: 'this_week', action: 'A4', rationale: 'R4', type: 'stakeholder_reengagement' },
              { priority: 'this_month', action: 'A5', rationale: 'R5', type: 'service_review' },
              { priority: 'immediate', action: 'A6', rationale: 'R6', type: 'escalation' },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      const types = result.map((a) => a.type);
      expect(types).toContain('qbr');
      expect(types).toContain('check_in');
      expect(types).toContain('invoice_followup');
      expect(types).toContain('stakeholder_reengagement');
      expect(types).toContain('service_review');
      expect(types).toContain('escalation');
    });
  });

  // ============================================================================
  // Action Description Field
  // ============================================================================

  describe('Action Description', () => {
    it('should include action field from response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Call the CEO to discuss quarterly goals',
                rationale: 'Build relationship',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].action).toBe('Call the CEO to discuss quarterly goals');
    });

    it('should preserve action text exactly as provided', async () => {
      const longAction = 'Schedule a comprehensive quarterly business review with CEO, CFO, and VP of Product to align on Q2/Q3 strategic initiatives, ROI metrics, and service value';

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: longAction,
                rationale: 'Strategic alignment needed',
                type: 'qbr',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].action).toBe(longAction);
    });

    it('should handle empty action string', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: '',
                rationale: 'Rationale',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].action).toBe('');
    });
  });

  // ============================================================================
  // Rationale Field
  // ============================================================================

  describe('Rationale Field', () => {
    it('should include rationale from response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Take action',
                rationale: 'This directly addresses the financial risk factor and shows proactive engagement',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].rationale).toBe(
        'This directly addresses the financial risk factor and shows proactive engagement'
      );
    });

    it('should default to empty string when rationale is missing', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Take action',
                // rationale intentionally omitted
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].rationale).toBe('');
    });

    it('should preserve rationale with special characters', async () => {
      const rationaleWithSpecialChars = "Client's concerns about ROI (25% drop YoY). Risk: they'll consider alternatives.";

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: rationaleWithSpecialChars,
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].rationale).toBe(rationaleWithSpecialChars);
    });
  });

  // ============================================================================
  // Prioritized Actions - Sorting Tests
  // ============================================================================

  describe('generatePrioritizedActions - Priority Sorting', () => {
    it('should sort actions by priority: immediate > this_week > this_month', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'this_month',
                action: 'Third priority action',
                rationale: 'Low priority',
                type: 'check_in',
              },
              {
                priority: 'immediate',
                action: 'First priority action',
                rationale: 'Highest priority',
                type: 'escalation',
              },
              {
                priority: 'this_week',
                action: 'Second priority action',
                rationale: 'Medium priority',
                type: 'qbr',
              },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result[0].priority).toBe('immediate');
      expect(result[1].priority).toBe('this_week');
      expect(result[2].priority).toBe('this_month');
    });

    it('should maintain order within same priority level', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'First immediate',
                rationale: 'R1',
                type: 'escalation',
              },
              {
                priority: 'this_week',
                action: 'First week',
                rationale: 'R2',
                type: 'check_in',
              },
              {
                priority: 'immediate',
                action: 'Second immediate',
                rationale: 'R3',
                type: 'escalation',
              },
              {
                priority: 'this_week',
                action: 'Second week',
                rationale: 'R4',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result[0].action).toBe('First immediate');
      expect(result[1].action).toBe('Second immediate');
      expect(result[2].action).toBe('First week');
      expect(result[3].action).toBe('Second week');
    });

    it('should handle mixed priority distribution', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { priority: 'this_month', action: 'A1', rationale: 'R1', type: 'check_in' },
              { priority: 'immediate', action: 'A2', rationale: 'R2', type: 'check_in' },
              { priority: 'this_month', action: 'A3', rationale: 'R3', type: 'check_in' },
              { priority: 'this_week', action: 'A4', rationale: 'R4', type: 'check_in' },
              { priority: 'immediate', action: 'A5', rationale: 'R5', type: 'check_in' },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      const priorities = result.map((a) => a.priority);
      // Should be [immediate, immediate, this_week, this_month, this_month]
      expect(priorities[0]).toBe('immediate');
      expect(priorities[1]).toBe('immediate');
      expect(priorities[2]).toBe('this_week');
      expect(priorities[3]).toBe('this_month');
      expect(priorities[4]).toBe('this_month');
    });

    it('should sort all immediate actions first', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { priority: 'this_week', action: 'Week', rationale: 'R', type: 'check_in' },
              { priority: 'immediate', action: 'Imm1', rationale: 'R', type: 'check_in' },
              { priority: 'this_month', action: 'Month', rationale: 'R', type: 'check_in' },
              { priority: 'immediate', action: 'Imm2', rationale: 'R', type: 'check_in' },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result[0].priority).toBe('immediate');
      expect(result[1].priority).toBe('immediate');
      expect(result[2].priority).toBe('this_week');
      expect(result[3].priority).toBe('this_month');
    });

    it('should sort all this_week actions before this_month', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { priority: 'this_month', action: 'Month1', rationale: 'R', type: 'check_in' },
              { priority: 'this_week', action: 'Week1', rationale: 'R', type: 'check_in' },
              { priority: 'this_month', action: 'Month2', rationale: 'R', type: 'check_in' },
              { priority: 'this_week', action: 'Week2', rationale: 'R', type: 'check_in' },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result[0].priority).toBe('this_week');
      expect(result[1].priority).toBe('this_week');
      expect(result[2].priority).toBe('this_month');
      expect(result[3].priority).toBe('this_month');
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw error on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(agent.generateActions(defaultInput)).rejects.toThrow(
        'Failed to generate suggested actions: Network error'
      );
    });

    it('should throw error on JSON parse failure', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Invalid JSON {broken',
          },
        ],
      });

      await expect(agent.generateActions(defaultInput)).rejects.toThrow(
        'Failed to generate suggested actions:'
      );
    });

    it('should return empty array on non-array response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ action: 'not an array' }),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toEqual([]);
    });

    it('should return empty array on null response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(null),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toEqual([]);
    });

    it('should return empty array on string response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify('just a string'),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Prompt Content Validation
  // ============================================================================

  describe('Prompt Content Validation', () => {
    it('should include churn probability in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('75');
    });

    it('should include health scores in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      expect(prompt).toContain('35');
      expect(prompt).toContain('25');
      expect(prompt).toContain('40');
      expect(prompt).toContain('45');
      expect(prompt).toContain('20');
    });

    it('should include churn factors in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      expect(prompt).toContain('Invoice payment 30 days late');
      expect(prompt).toContain('Decreased stakeholder engagement');
    });

    it('should include client name in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('TechStartup Inc');
    });

    it('should include service type in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Premium SaaS');
    });

    it('should include monthly retainer in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('8000');
    });

    it('should include last meeting days ago in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      await agent.generateActions(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('45');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle response with extra fields', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: 'Reason',
                type: 'check_in',
                extraField1: 'ignore',
                extraField2: 12345,
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Action');
      // Extra fields should not be in result
      expect(Object.keys(result[0])).not.toContain('extraField1');
    });

    it('should handle large number of actions', async () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        priority: ['immediate', 'this_week', 'this_month'][i % 3] as any,
        action: `Action ${i + 1}`,
        rationale: `Rationale ${i + 1}`,
        type: 'check_in',
      }));

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(actions),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result).toHaveLength(10);
      expect(result.every((action) => action.id)).toBe(true);
    });

    it('should handle very long action description', async () => {
      const longAction = 'A'.repeat(500);

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: longAction,
                rationale: 'Reason',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].action).toBe(longAction);
    });

    it('should handle very long rationale text', async () => {
      const longRationale = 'This is a detailed rationale explaining the business reasoning behind this action. '.repeat(10);

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Action',
                rationale: longRationale,
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(defaultInput);

      expect(result[0].rationale).toBe(longRationale);
    });

    it('should handle zero churn probability', async () => {
      const input: SuggestedActionsInput = {
        ...defaultInput,
        churnProbability: 0,
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'this_month',
                action: 'Maintain relationship',
                rationale: 'Low risk',
                type: 'check_in',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(input);

      expect(result).toHaveLength(1);
    });

    it('should handle 100% churn probability', async () => {
      const input: SuggestedActionsInput = {
        ...defaultInput,
        churnProbability: 100,
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'immediate',
                action: 'Emergency intervention',
                rationale: 'Critical risk',
                type: 'escalation',
              },
            ]),
          },
        ],
      });

      const result = await agent.generateActions(input);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // generatePrioritizedActions - Integration Tests
  // ============================================================================

  describe('generatePrioritizedActions Integration', () => {
    it('should call generateActions and sort results', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'this_month',
                action: 'Monthly action',
                rationale: 'Low priority',
                type: 'check_in',
              },
              {
                priority: 'immediate',
                action: 'Immediate action',
                rationale: 'Highest priority',
                type: 'escalation',
              },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      // Should be sorted
      expect(result[0].action).toBe('Immediate action');
      expect(result[1].action).toBe('Monthly action');
    });

    it('should preserve all fields through sorting', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                priority: 'this_week',
                action: 'Week action',
                rationale: 'Week rationale',
                type: 'qbr',
              },
              {
                priority: 'immediate',
                action: 'Immediate action',
                rationale: 'Immediate rationale',
                type: 'escalation',
              },
            ]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result[0]).toMatchObject({
        action: 'Immediate action',
        rationale: 'Immediate rationale',
        type: 'escalation',
        priority: 'immediate',
      });

      expect(result[1]).toMatchObject({
        action: 'Week action',
        rationale: 'Week rationale',
        type: 'qbr',
        priority: 'this_week',
      });
    });

    it('should handle empty response from prioritization', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      const result = await agent.generatePrioritizedActions(defaultInput);

      expect(result).toEqual([]);
    });
  });
});

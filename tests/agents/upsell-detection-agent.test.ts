/**
 * Comprehensive tests for the Upsell Detection Agent
 *
 * Tests cover:
 * 1. Early return when no upsell mentions provided
 * 2. Single and multiple upsell opportunities detection
 * 3. Field mapping and default values
 * 4. Generated ID format and uniqueness
 * 5. Constant sourceType and ISO date formatting
 * 6. API errors, JSON parsing errors, non-array responses
 * 7. Missing fields and partial responses
 * 8. Prompt content validation (includes client context)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpsellDetectionAgent, UpsellDetectionInput } from '../../src/lib/agents/upsell-detection-agent';

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class {
      messages = { create: mockCreate };
    },
  };
});

describe('UpsellDetectionAgent', () => {
  let agent: UpsellDetectionAgent;

  const defaultInput: UpsellDetectionInput = {
    clientId: 'client-123',
    clientName: 'Acme Corp',
    currentServices: 'Basic Plan, Email Marketing',
    monthlyRetainer: 5000,
    upsellMentions: [
      {
        mention: 'We need better analytics for our campaigns',
        context: 'During budget planning discussion',
        meetingDate: '2026-04-10',
        meetingId: 'meet-001',
      },
    ],
    recentMeetingSummaries: [
      'Discussed Q2 goals and growth plans',
      'Budget review with CFO',
    ],
  };

  beforeEach(() => {
    agent = new UpsellDetectionAgent();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Early Return Tests
  // ============================================================================

  describe('Early Return - No API Call', () => {
    it('should return empty array if upsellMentions is empty without calling API', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        upsellMentions: [],
      };

      const result = await agent.detectUpsellOpportunities(input);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should not make API call even with extensive other data when mentions are empty', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        upsellMentions: [],
        recentMeetingSummaries: ['Summary 1', 'Summary 2', 'Summary 3'],
        monthlyRetainer: 50000,
      };

      const result = await agent.detectUpsellOpportunities(input);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Single Opportunity Detection
  // ============================================================================

  describe('Single Upsell Opportunity', () => {
    it('should detect and return a single upsell opportunity', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Client mentioned need for advanced analytics',
                context: 'During Q2 planning, CFO asked about attribution modeling',
                suggestedService: 'Premium Analytics Package',
                estimatedValue: 2500,
                confidence: 'high',
                meetingId: 'meet-001',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        clientId: 'client-123',
        clientName: 'Acme Corp',
        signal: 'Client mentioned need for advanced analytics',
        suggestedService: 'Premium Analytics Package',
        estimatedValue: 2500,
        confidence: 'high',
        sourceType: 'meeting_transcript',
        sourceMeetingId: 'meet-001',
      });
    });

    it('should generate ID with correct format for single opportunity', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test signal',
                context: 'Test context',
                suggestedService: 'Test service',
                estimatedValue: 1000,
                confidence: 'medium',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].id).toMatch(/^upsell_client-123_[a-z0-9]+$/);
    });
  });

  // ============================================================================
  // Multiple Opportunities Detection
  // ============================================================================

  describe('Multiple Upsell Opportunities', () => {
    it('should detect and return multiple upsell opportunities', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        upsellMentions: [
          {
            mention: 'Analytics need',
            context: 'CFO asked about attribution',
            meetingDate: '2026-04-10',
            meetingId: 'meet-001',
          },
          {
            mention: 'Automation request',
            context: 'VP Marketing wants workflow automation',
            meetingDate: '2026-04-11',
            meetingId: 'meet-002',
          },
          {
            mention: 'Integration with CRM',
            context: 'Need to sync with Salesforce',
            meetingDate: '2026-04-12',
            meetingId: 'meet-003',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Analytics need',
                context: 'CFO asked about attribution',
                suggestedService: 'Premium Analytics',
                estimatedValue: 2500,
                confidence: 'high',
                meetingId: 'meet-001',
              },
              {
                signal: 'Automation request',
                context: 'VP Marketing wants workflow automation',
                suggestedService: 'Automation Suite',
                estimatedValue: 3000,
                confidence: 'high',
                meetingId: 'meet-002',
              },
              {
                signal: 'Integration with CRM',
                context: 'Need to sync with Salesforce',
                suggestedService: 'CRM Integration Module',
                estimatedValue: 1500,
                confidence: 'medium',
                meetingId: 'meet-003',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(input);

      expect(result).toHaveLength(3);
      expect(result[0].suggestedService).toBe('Premium Analytics');
      expect(result[1].suggestedService).toBe('Automation Suite');
      expect(result[2].suggestedService).toBe('CRM Integration Module');
    });

    it('should generate unique IDs for multiple opportunities', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        upsellMentions: [
          {
            mention: 'First mention',
            context: 'Context 1',
            meetingDate: '2026-04-10',
            meetingId: 'meet-001',
          },
          {
            mention: 'Second mention',
            context: 'Context 2',
            meetingDate: '2026-04-11',
            meetingId: 'meet-002',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Signal 1',
                context: 'Context 1',
                suggestedService: 'Service 1',
                estimatedValue: 1000,
                confidence: 'high',
              },
              {
                signal: 'Signal 2',
                context: 'Context 2',
                suggestedService: 'Service 2',
                estimatedValue: 2000,
                confidence: 'medium',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(input);

      expect(result[0].id).not.toBe(result[1].id);
      expect(result.every((opp) => opp.id.startsWith('upsell_client-123_'))).toBe(true);
    });
  });

  // ============================================================================
  // Field Mapping and Defaults
  // ============================================================================

  describe('Field Mapping and Defaults', () => {
    it('should map all response fields correctly to UpsellOpportunity', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Client needs advanced features',
                context: 'Detailed context from meeting',
                suggestedService: 'Premium Service',
                estimatedValue: 5000,
                confidence: 'high',
                meetingId: 'meet-001',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0]).toMatchObject({
        clientId: defaultInput.clientId,
        clientName: defaultInput.clientName,
        signal: 'Client needs advanced features',
        context: 'Detailed context from meeting',
        currentServices: defaultInput.currentServices,
        suggestedService: 'Premium Service',
        estimatedValue: 5000,
        confidence: 'high',
        sourceType: 'meeting_transcript',
        sourceMeetingId: 'meet-001',
      });
    });

    it('should apply default confidence value when missing from response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Signal without confidence',
                context: 'Context here',
                suggestedService: 'Service',
                estimatedValue: 1000,
                // confidence intentionally omitted
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].confidence).toBe('medium');
    });

    it('should default estimatedValue to null when missing', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Signal',
                context: 'Context',
                suggestedService: 'Service',
                // estimatedValue intentionally omitted
                confidence: 'low',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].estimatedValue).toBeNull();
    });

    it('should preserve currentServices from input', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        currentServices: 'Custom: Analytics, CRM, Automation',
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Signal',
                context: 'Context',
                suggestedService: 'New service',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(input);

      expect(result[0].currentServices).toBe('Custom: Analytics, CRM, Automation');
    });

    it('should handle empty strings for signal and context', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: '',
                context: '',
                suggestedService: 'Service',
                estimatedValue: 1000,
                confidence: 'medium',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].signal).toBe('');
      expect(result[0].context).toBe('');
    });
  });

  // ============================================================================
  // ID Generation Format
  // ============================================================================

  describe('Generated ID Format', () => {
    it('should generate ID starting with upsell_', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].id).toMatch(/^upsell_/);
    });

    it('should include client ID in generated ID', async () => {
      const input: UpsellDetectionInput = {
        ...defaultInput,
        clientId: 'special-client-xyz',
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(input);

      expect(result[0].id).toMatch(/^upsell_special-client-xyz_/);
    });
  });

  // ============================================================================
  // SourceType Constant
  // ============================================================================

  describe('SourceType', () => {
    it('should always set sourceType to meeting_transcript', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].sourceType).toBe('meeting_transcript');
    });

    it('should maintain sourceType even with multiple opportunities', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test 1',
                context: 'Test 1',
                suggestedService: 'Test 1',
                estimatedValue: 1000,
                confidence: 'high',
              },
              {
                signal: 'Test 2',
                context: 'Test 2',
                suggestedService: 'Test 2',
                estimatedValue: 2000,
                confidence: 'medium',
              },
            ]),
          },
        ],
      });

      const input: UpsellDetectionInput = {
        ...defaultInput,
        upsellMentions: [...defaultInput.upsellMentions, ...defaultInput.upsellMentions],
      };

      const result = await agent.detectUpsellOpportunities(input);

      expect(result.every((opp) => opp.sourceType === 'meeting_transcript')).toBe(true);
    });
  });

  // ============================================================================
  // DetectedAt Format
  // ============================================================================

  describe('DetectedAt ISO Date Format', () => {
    it('should set detectedAt to ISO date string', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should use current time for detectedAt', async () => {
      const beforeCall = new Date();

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);
      const afterCall = new Date();

      const detectedAt = new Date(result[0].detectedAt);
      expect(detectedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(detectedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime() + 1000);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('API Error Handling', () => {
    it('should throw error with proper message on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API connection failed'));

      await expect(agent.detectUpsellOpportunities(defaultInput)).rejects.toThrow(
        'Failed to detect upsell opportunities: API connection failed'
      );
    });

    it('should include original error message in thrown error', async () => {
      const originalError = new Error('Rate limit exceeded');
      mockCreate.mockRejectedValueOnce(originalError);

      await expect(agent.detectUpsellOpportunities(defaultInput)).rejects.toThrow(
        'Failed to detect upsell opportunities: Rate limit exceeded'
      );
    });

    it('should handle non-Error objects in API failure', async () => {
      mockCreate.mockRejectedValueOnce('Unknown error string');

      await expect(agent.detectUpsellOpportunities(defaultInput)).rejects.toThrow(
        'Failed to detect upsell opportunities: Unknown error'
      );
    });
  });

  // ============================================================================
  // JSON Parsing Error Handling
  // ============================================================================

  describe('JSON Parsing Error Handling', () => {
    it('should throw error on invalid JSON response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Not valid JSON {broken]',
          },
        ],
      });

      await expect(agent.detectUpsellOpportunities(defaultInput)).rejects.toThrow(
        'Failed to detect upsell opportunities:'
      );
    });

    it('should throw error on malformed JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '{"incomplete": ',
          },
        ],
      });

      await expect(agent.detectUpsellOpportunities(defaultInput)).rejects.toThrow(
        'Failed to detect upsell opportunities:'
      );
    });
  });

  // ============================================================================
  // Non-Array Response Handling
  // ============================================================================

  describe('Non-Array Response Handling', () => {
    it('should return empty array when response is not an array', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ signal: 'Not an array' }),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toEqual([]);
    });

    it('should return empty array when response is a string', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify('Just a string'),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toEqual([]);
    });

    it('should return empty array when response is null', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify(null),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Prompt Content Validation
  // ============================================================================

  describe('Prompt Content Validation', () => {
    it('should include client name in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      await agent.detectUpsellOpportunities(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Acme Corp');
    });

    it('should include current services in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      await agent.detectUpsellOpportunities(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Basic Plan, Email Marketing');
    });

    it('should include monthly retainer in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      await agent.detectUpsellOpportunities(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('5000');
    });

    it('should include upsell mentions in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      await agent.detectUpsellOpportunities(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(
        'We need better analytics for our campaigns'
      );
    });

    it('should include meeting summaries in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      await agent.detectUpsellOpportunities(defaultInput);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Discussed Q2 goals and growth plans');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty string values in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: '',
                context: '',
                suggestedService: '',
                estimatedValue: null,
                confidence: 'low',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toHaveLength(1);
      expect(result[0].signal).toBe('');
      expect(result[0].suggestedService).toBe('');
    });

    it('should handle zero estimated value (converts to null due to || operator)', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 0,
                confidence: 'low',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      // Agent uses || operator which converts 0 to null
      expect(result[0].estimatedValue).toBeNull();
    });

    it('should handle negative estimated values', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: -500,
                confidence: 'medium',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].estimatedValue).toBe(-500);
    });

    it('should handle very large estimated values', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 999999999,
                confidence: 'high',
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].estimatedValue).toBe(999999999);
    });

    it('should handle response with extra fields', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test signal',
                context: 'Test context',
                suggestedService: 'Test service',
                estimatedValue: 1000,
                confidence: 'high',
                meetingId: 'meet-001',
                extraField1: 'Should be ignored',
                extraField2: 12345,
                extraField3: { nested: 'data' },
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result).toHaveLength(1);
      expect(result[0].signal).toBe('Test signal');
      // Extra fields should not appear in result
      expect(Object.keys(result[0])).not.toContain('extraField1');
    });

    it('should handle missing meetingId in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
                // meetingId intentionally omitted
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].sourceMeetingId).toBeUndefined();
    });

    it('should handle null meetingId', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                signal: 'Test',
                context: 'Test',
                suggestedService: 'Test',
                estimatedValue: 1000,
                confidence: 'high',
                meetingId: null,
              },
            ]),
          },
        ],
      });

      const result = await agent.detectUpsellOpportunities(defaultInput);

      expect(result[0].sourceMeetingId).toBeNull();
    });
  });
});

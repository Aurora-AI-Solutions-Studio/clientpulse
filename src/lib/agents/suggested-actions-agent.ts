/**
 * Suggested Actions Agent v1
 * Generates specific, actionable recommendations based on churn prediction and client context
 */

import Anthropic from '@anthropic-ai/sdk';
import { SuggestedAction } from '../../types/alerts';

/**
 * Input parameters for suggested actions generation
 */
export interface SuggestedActionsInput {
  clientId: string;
  clientName: string;
  churnProbability: number;
  churnFactors: { category: string; signal: string; details: string }[];
  currentHealthScore: number;
  healthBreakdown: { financial: number; relationship: number; delivery: number; engagement: number };
  lastMeetingDaysAgo: number;
  serviceType: string;
  monthlyRetainer: number;
}

/**
 * SuggestedActionsAgent generates specific account management recommendations
 */
export class SuggestedActionsAgent {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Generates specific action recommendations to address churn risks
   * @param input - Input with churn analysis and client context
   * @returns Array of SuggestedAction with specific recommendations
   */
  async generateActions(input: SuggestedActionsInput): Promise<SuggestedAction[]> {
    const systemPrompt = `You are an expert account manager specializing in client retention and growth. Your job is to generate specific, actionable recommendations to address client risk factors. Respond with ONLY valid JSON (no markdown, no extra text).

Rules for action generation:
- Actions must be specific and immediately actionable
- Priority depends on urgency: immediate for critical risks, this_week for high risks, this_month for medium risks
- Types: qbr (quarterly business review), check_in (casual touchpoint), invoice_followup (payment issues), stakeholder_reengagement (low engagement), service_review (delivery issues), escalation (needs leadership)
- Each action should have a clear rationale tied to the risk factors
- Generate 3-6 actions total, prioritizing high-impact items`;

    const userPrompt = `Generate action recommendations for: ${input.clientName}

Churn Analysis:
- Churn Probability: ${input.churnProbability}%
- Current Health: ${input.currentHealthScore}/100

Risk Factors:
${input.churnFactors.map((f) => `- ${f.category.toUpperCase()}: ${f.signal} (${f.details})`).join('\n')}

Health Breakdown:
- Financial: ${input.healthBreakdown.financial}/100
- Relationship: ${input.healthBreakdown.relationship}/100
- Delivery: ${input.healthBreakdown.delivery}/100
- Engagement: ${input.healthBreakdown.engagement}/100

Client Context:
- Service Type: ${input.serviceType}
- Monthly Retainer: $${input.monthlyRetainer}
- Last Meeting: ${input.lastMeetingDaysAgo} days ago

Generate 3-6 specific, actionable recommendations. For each action:
1. Determine priority based on risk severity and current health
2. Select appropriate action type
3. Provide specific, detailed action description
4. Explain why it helps prevent churn

Respond with ONLY valid JSON array (no markdown):
[
  {
    "priority": "<'immediate' | 'this_week' | 'this_month'>",
    "action": "<specific action to take>",
    "rationale": "<why this action helps prevent churn, tied to risk factors>",
    "type": "<'qbr' | 'check_in' | 'invoice_followup' | 'stakeholder_reengagement' | 'service_review' | 'escalation'>"
  }
]

Ensure actions are specific: "Schedule QBR with finance team to review ROI" not "Have a meeting".`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = JSON.parse(responseText);

      // Ensure parsed is an array
      const actions = Array.isArray(parsed) ? parsed : [];

      return actions.map((action: unknown, index: number) => {
        const actionData = action as Record<string, unknown>;
        return {
          id: `action_${input.clientId}_${index}`,
          priority: ((actionData.priority as string) || 'this_week') as SuggestedAction['priority'],
          action: (actionData.action as string) || '',
          rationale: (actionData.rationale as string) || '',
          type: ((actionData.type as string) || 'check_in') as SuggestedAction['type'],
        };
      });
    } catch (error) {
      console.error('Error generating suggested actions:', error);
      throw new Error(
        `Failed to generate suggested actions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates priority-ordered action list with rationale
   * @param input - Input with churn and health data
   * @returns Array of prioritized SuggestedAction items
   */
  async generatePrioritizedActions(input: SuggestedActionsInput): Promise<SuggestedAction[]> {
    const actions = await this.generateActions(input);

    // Sort by priority: immediate > this_week > this_month
    const priorityOrder = { immediate: 0, this_week: 1, this_month: 2 };
    return actions.sort(
      (a, b) =>
        (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3)
    );
  }
}

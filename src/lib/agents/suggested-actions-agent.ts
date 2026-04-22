/**
 * Suggested Actions Agent v1
 *
 * Sprint 8A M1.1: routes through the multi-model LLM client. Model
 * selection follows the caller's subscription plan:
 *   - solo     → gpt-4o-mini
 *   - pro      → claude-sonnet-4-5
 *   - agency   → claude-sonnet-4-5 (with capability-based auto-routing)
 */
import type { SubscriptionPlan } from '@/types/stripe';
import { generateCompletionWithRetry } from '@/lib/llm/retry';
import type { LLMMessage } from '@/lib/llm/types';
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
  private readonly plan: SubscriptionPlan;

  /**
   * @param plan - The calling tenant's subscription plan. Defaults to
   *               'pro' so existing callers that use
   *               `new SuggestedActionsAgent()` continue to select
   *               Claude Sonnet 4.5 (the pre-M1.1 default model).
   */
  constructor(plan: SubscriptionPlan = 'pro') {
    this.plan = plan;
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

    const messages: LLMMessage[] = [{ role: 'user', content: userPrompt }];

    try {
      const response = await generateCompletionWithRetry(
        {
          plan: this.plan,
          request: {
            model: 'claude-sonnet-4-5',
            max_tokens: 2000,
            system: systemPrompt,
            messages,
          },
          routing: { capability: 'content', substituteOnTierMiss: true },
        },
        '[suggested-actions-agent]',
      );

      const responseText = response.text;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[suggested-actions-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
        throw new Error(
          `[suggested-actions-agent] Model returned non-JSON response: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
        );
      }

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

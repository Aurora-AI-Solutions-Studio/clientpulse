/**
 * Upsell Detection Agent v1
 *
 * Sprint 8A M1.1: routes through the multi-model LLM client. Model
 * selection follows the caller's subscription plan:
 *   - starter  → gpt-4o-mini
 *   - pro      → claude-sonnet-4-5
 *   - agency   → claude-sonnet-4-5 (with capability-based auto-routing)
 */
import type { SubscriptionPlan } from '@/types/stripe';
import { generateCompletionWithRetry } from '@/lib/llm/retry';
import type { LLMMessage } from '@/lib/llm/types';
import { UpsellOpportunity } from '../../types/alerts';

/**
 * Input parameters for upsell detection
 */
export interface UpsellDetectionInput {
  clientId: string;
  clientName: string;
  currentServices: string;
  monthlyRetainer: number;
  upsellMentions: { mention: string; context: string; meetingDate: string; meetingId: string }[];
  recentMeetingSummaries: string[];
}

/**
 * UpsellDetectionAgent identifies and scores upsell opportunities
 */
export class UpsellDetectionAgent {
  private readonly plan: SubscriptionPlan;

  /**
   * @param plan - The calling tenant's subscription plan. Defaults to
   *               'pro' so existing callers that use
   *               `new UpsellDetectionAgent()` continue to select
   *               Claude Sonnet 4.5 (the pre-M1.1 default model).
   */
  constructor(plan: SubscriptionPlan = 'pro') {
    this.plan = plan;
  }

  /**
   * Detects upsell opportunities from meeting intelligence
   * @param input - Input with meeting mentions and client context
   * @returns Array of UpsellOpportunity with confidence scores and service suggestions
   */
  async detectUpsellOpportunities(input: UpsellDetectionInput): Promise<UpsellOpportunity[]> {
    // Return empty array if no mentions to analyze
    if (input.upsellMentions.length === 0) {
      return [];
    }

    const systemPrompt = `You are an expert sales consultant specializing in B2B account expansion. Your job is to analyze meeting intelligence to identify high-confidence upsell opportunities. Respond with ONLY valid JSON (no markdown, no extra text).

Consider these factors:
- Direct mentions of pain points or unmet needs
- Questions about capabilities the client doesn't currently have
- Expansion into new markets or verticals
- Increased complexity requiring premium services
- Budget allocation signals

Provide realistic value estimates based on current retainer and service scope.`;

    const userPrompt = `Analyze upsell opportunities for: ${input.clientName}

Current Services: ${input.currentServices}
Monthly Retainer: $${input.monthlyRetainer}

Recent Meeting Mentions (potential upsell signals):
${input.upsellMentions.map((m) => `- "${m.mention}" (context: ${m.context}, ${m.meetingDate})`).join('\n')}

Recent Meeting Summaries:
${input.recentMeetingSummaries.map((s) => `- ${s}`).join('\n')}

For each valid upsell opportunity, provide:
1. The signal that triggered it
2. Context from meetings
3. Suggested service
4. Realistic estimated monthly value
5. Confidence score (high/medium/low)

Respond with ONLY valid JSON array (no markdown):
[
  {
    "signal": "<what the client mentioned or implied>",
    "context": "<detailed context from meetings>",
    "suggestedService": "<specific service to offer>",
    "estimatedValue": <monthly value or null if unknown>,
    "confidence": "<'high' | 'medium' | 'low'>",
    "meetingId": "<meeting ID if applicable>"
  }
]

Return empty array [] if no valid upsell opportunities found.`;

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
          routing: { capability: 'reasoning', substituteOnTierMiss: true },
        },
        '[upsell-detection-agent]',
      );

      const responseText = response.text;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[upsell-detection-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
        throw new Error(
          `[upsell-detection-agent] Model returned non-JSON response: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
        );
      }

      // Ensure parsed is an array
      const opportunities = Array.isArray(parsed) ? parsed : [];

      return opportunities.map((opp: unknown) => {
        const oppData = opp as Record<string, unknown>;
        return {
          id: `upsell_${input.clientId}_${Math.random().toString(36).substring(7)}`,
          clientId: input.clientId,
          clientName: input.clientName,
          signal: (oppData.signal as string) || '',
          context: (oppData.context as string) || '',
          currentServices: input.currentServices,
          suggestedService: (oppData.suggestedService as string) || '',
          estimatedValue: (oppData.estimatedValue as number | null) || null,
          confidence: ((oppData.confidence as string) || 'medium') as UpsellOpportunity['confidence'],
          sourceType: 'meeting_transcript' as const,
          sourceMeetingId: oppData.meetingId as string | undefined,
          detectedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Error detecting upsell opportunities:', error);
      throw new Error(
        `Failed to detect upsell opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

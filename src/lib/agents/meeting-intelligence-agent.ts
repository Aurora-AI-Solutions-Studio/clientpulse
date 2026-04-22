/**
 * Meeting Intelligence Agent v1
 *
 * Sprint 8A M1.1: routes through the multi-model LLM client. Model
 * selection follows the caller's subscription plan:
 *   - solo     → gpt-4o-mini
 *   - pro      → claude-sonnet-4-5
 *   - agency   → claude-sonnet-4-5 (with capability-based auto-routing)
 *
 * Transcript analysis is tagged as `long-context` to hint the router
 * toward models with sufficient effective context when auto-routing.
 */
import type { SubscriptionPlan } from '@/types/stripe';
import { generateCompletionWithRetry } from '@/lib/llm/retry';
import type { LLMMessage } from '@/lib/llm/types';

/**
 * Action item extracted from meeting transcript
 */
export interface ActionItem {
  title: string;
  assignee: string;
  deadline: string | null;
}

/**
 * Scope change detected in meeting
 */
export interface ScopeChange {
  description: string;
  impact: string;
}

/**
 * Stakeholder engagement metrics
 */
export interface StakeholderEngagement {
  attendees: string[];
  decision_makers_present: boolean;
  engagement_level: 'high' | 'medium' | 'low';
}

/**
 * Escalation signal detected in meeting
 */
export interface EscalationSignal {
  signal: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Upsell opportunity mentioned in meeting
 */
export interface UpsellMention {
  mention: string;
  estimated_value: number | null;
  context: string;
}

/**
 * Complete meeting intelligence result
 */
export interface MeetingIntelligenceResult {
  sentiment_score: number; // 1-10
  action_items: ActionItem[];
  scope_changes: ScopeChange[];
  stakeholder_engagement: StakeholderEngagement;
  escalation_signals: EscalationSignal[];
  upsell_mentions: UpsellMention[];
  summary: string;
  extracted_at: number;
}

/**
 * MeetingIntelligenceAgent extracts structured intelligence from meeting transcripts
 */
export class MeetingIntelligenceAgent {
  private readonly plan: SubscriptionPlan;

  /**
   * @param plan - The calling tenant's subscription plan. Defaults to
   *               'pro' so existing callers that use
   *               `new MeetingIntelligenceAgent()` continue to select
   *               Claude Sonnet 4.5 (the pre-M1.1 default model).
   */
  constructor(plan: SubscriptionPlan = 'pro') {
    this.plan = plan;
  }

  /**
   * Extracts comprehensive meeting intelligence from a transcript
   * @param transcript - The meeting transcript text
   * @param clientName - The client name for context
   * @returns MeetingIntelligenceResult with all extracted intelligence
   */
  async extractMeetingIntelligence(
    transcript: string,
    clientName: string
  ): Promise<MeetingIntelligenceResult> {
    const prompt = `You are an expert meeting analyst. Analyze the following meeting transcript for client "${clientName}" and extract structured intelligence.

Meeting Transcript:
${transcript}

Please analyze this meeting and respond with ONLY a valid JSON object (no markdown, no extra text) containing:
{
  "sentiment_score": <number 1-10 where 10 is very positive>,
  "action_items": [
    {
      "title": "<string>",
      "assignee": "<string or 'TBD' if not specified>",
      "deadline": "<string date like 'YYYY-MM-DD' or null if not mentioned>"
    }
  ],
  "scope_changes": [
    {
      "description": "<string>",
      "impact": "<string describing the impact>"
    }
  ],
  "stakeholder_engagement": {
    "attendees": [<list of attendee names as strings>],
    "decision_makers_present": <boolean>,
    "engagement_level": "<'high' | 'medium' | 'low'>"
  },
  "escalation_signals": [
    {
      "signal": "<string>",
      "severity": "<'high' | 'medium' | 'low'>"
    }
  ],
  "upsell_mentions": [
    {
      "mention": "<string>",
      "estimated_value": <number or null>,
      "context": "<string>"
    }
  ],
  "summary": "<brief 2-3 sentence summary of the meeting>"
}

Ensure all fields are present even if empty arrays/null are needed. Return ONLY valid JSON.`;

    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

    try {
      const response = await generateCompletionWithRetry(
        {
          plan: this.plan,
          request: {
            model: 'claude-sonnet-4-5',
            max_tokens: 2000,
            messages,
          },
          routing: { capability: 'long-context', substituteOnTierMiss: true },
        },
        '[meeting-intelligence-agent]',
      );

      const responseText = response.text;

      // Parse JSON response — propagate parse errors so callers can
      // fall back / retry rather than silently producing defaults.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[meeting-intelligence-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
        throw new Error(
          `[meeting-intelligence-agent] Model returned non-JSON response: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
        );
      }

      return {
        sentiment_score: parsed.sentiment_score || 5,
        action_items: parsed.action_items || [],
        scope_changes: parsed.scope_changes || [],
        stakeholder_engagement: parsed.stakeholder_engagement || {
          attendees: [],
          decision_makers_present: false,
          engagement_level: 'medium',
        },
        escalation_signals: parsed.escalation_signals || [],
        upsell_mentions: parsed.upsell_mentions || [],
        summary: parsed.summary || 'Meeting analysis complete.',
        extracted_at: Date.now(),
      };
    } catch (error) {
      console.error('Error extracting meeting intelligence:', error);
      throw new Error(
        `Failed to extract meeting intelligence: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

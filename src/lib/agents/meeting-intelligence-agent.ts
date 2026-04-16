/**
 * Meeting Intelligence Agent v1
 * Extracts structured intelligence from meeting transcripts using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

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
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
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

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text from response
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse JSON response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[meeting-intelligence-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
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

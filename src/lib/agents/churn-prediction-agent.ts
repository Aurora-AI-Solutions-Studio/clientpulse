/**
 * Churn Prediction Agent v1
 * Predicts client churn risk based on health score, meeting intelligence, financial data, and action items
 */

import Anthropic from '@anthropic-ai/sdk';
import { ChurnPrediction, SuggestedAction, SavePlan } from '../../types/alerts';
import { createMessageWithRetry } from './anthropic-retry';

/**
 * Input parameters for churn prediction
 */
export interface ChurnPredictionInput {
  clientId: string;
  clientName: string;
  currentHealthScore: number;
  healthScoreHistory: { score: number; date: string }[];
  healthBreakdown: { financial: number; relationship: number; delivery: number; engagement: number };
  recentMeetingSentiments: number[];
  actionItemStats: { total: number; completed: number; overdue: number };
  lastMeetingDaysAgo: number;
  monthlyRetainer: number;
  serviceType: string;
  overdueInvoices: number;
  meetingFrequencyTrend: 'increasing' | 'stable' | 'declining';
}

/**
 * ChurnPredictionAgent predicts client churn probability and suggests mitigation actions
 */
export class ChurnPredictionAgent {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Predicts churn probability for a client and generates mitigation strategy
   * @param input - Input parameters with client metrics
   * @returns ChurnPrediction with probability, risk factors, and suggested actions
   */
  async predictChurn(input: ChurnPredictionInput): Promise<ChurnPrediction> {
    const systemPrompt = `You are an expert account manager and churn prediction analyst. Your job is to analyze client health metrics and predict churn probability. You must respond with ONLY valid JSON (no markdown, no extra text).

Consider these factors when predicting churn:
- Health score decline over time indicates risk
- Low relationship/engagement scores are red flags
- Overdue invoices and payment delays signal financial distress
- Declining meeting frequency suggests disengagement
- High overdue action items indicate delivery problems

For each driving factor, provide a negative impact score (e.g., -5 means it reduces churn probability by 5 points).
Generate 3-5 immediate, practical suggested actions.`;

    const userPrompt = `Analyze this client's churn risk:

Client: ${input.clientName} (ID: ${input.clientId})
Monthly Retainer: $${input.monthlyRetainer}
Service Type: ${input.serviceType}

Current Health Score: ${input.currentHealthScore}/100
Health Breakdown:
- Financial: ${input.healthBreakdown.financial}/100
- Relationship: ${input.healthBreakdown.relationship}/100
- Delivery: ${input.healthBreakdown.delivery}/100
- Engagement: ${input.healthBreakdown.engagement}/100

Health Score Trend: ${input.healthScoreHistory.slice(-3).map(h => `${h.score}/100 on ${h.date}`).join(', ')}

Meeting Sentiment (last 5): ${input.recentMeetingSentiments.join(', ')} (1-10 scale)
Last Meeting: ${input.lastMeetingDaysAgo} days ago
Meeting Frequency Trend: ${input.meetingFrequencyTrend}

Action Items: ${input.actionItemStats.total} total, ${input.actionItemStats.completed} completed, ${input.actionItemStats.overdue} overdue
Overdue Invoices: ${input.overdueInvoices}

Respond with ONLY valid JSON (no markdown) in this exact format:
{
  "churnProbability": <number 0-100>,
  "riskLevel": "<'critical' | 'high' | 'moderate' | 'low'>",
  "drivingFactors": [
    {
      "category": "<'financial' | 'relationship' | 'delivery' | 'engagement'>",
      "signal": "<brief signal description>",
      "impact": <negative number indicating impact on churn probability>,
      "details": "<explanation of why this is a risk factor>"
    }
  ],
  "suggestedActions": [
    {
      "id": "<action_N>",
      "priority": "<'immediate' | 'this_week' | 'this_month'>",
      "action": "<specific action to take>",
      "rationale": "<why this action helps prevent churn>",
      "type": "<'qbr' | 'check_in' | 'invoice_followup' | 'stakeholder_reengagement' | 'service_review' | 'escalation'>"
    }
  ],
  "shouldCreateSavePlan": <boolean - true if churnProbability > 60>
}`;

    try {
      const message = await createMessageWithRetry(
        this.client,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        '[churn-prediction-agent]'
      );

      // Extract text from response
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse JSON response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[churn-prediction-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
      }

      const suggestedActions: SuggestedAction[] = (parsed.suggestedActions || []).map(
        (action: unknown) => {
          const actionData = action as Record<string, unknown>;
          return {
            id: (actionData.id as string) || `action_${Math.random().toString(36).substring(7)}`,
            priority: (actionData.priority as string) || 'this_week',
            action: (actionData.action as string) || '',
            rationale: (actionData.rationale as string) || '',
            type: (actionData.type as string) || 'check_in',
          };
        }
      );

      let savePlan: SavePlan | undefined;
      if (parsed.shouldCreateSavePlan && parsed.churnProbability > 60) {
        savePlan = await this.generateSavePlan(input, suggestedActions);
      }

      return {
        clientId: input.clientId,
        clientName: input.clientName,
        churnProbability: Math.min(100, Math.max(0, parsed.churnProbability || 0)),
        riskLevel: parsed.riskLevel || 'moderate',
        drivingFactors: parsed.drivingFactors || [],
        suggestedActions,
        savePlan,
        computedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error predicting churn:', error);
      throw new Error(
        `Failed to predict churn: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates a save plan with email and QBR agenda
   */
  private async generateSavePlan(
    input: ChurnPredictionInput,
    suggestedActions: SuggestedAction[]
  ): Promise<SavePlan> {
    const systemPrompt = `You are an expert account manager specializing in client retention. Create a detailed save plan to prevent client churn. Respond with ONLY valid JSON (no markdown, no extra text).`;

    const userPrompt = `Create a save plan for ${input.clientName} who has high churn risk.

Client Context:
- Monthly Retainer: $${input.monthlyRetainer}
- Service Type: ${input.serviceType}
- Current Health Score: ${input.currentHealthScore}/100
- Suggested Actions: ${suggestedActions.map(a => a.action).join(', ')}

Generate a save plan with:
1. A check-in email (subject + body)
2. A QBR agenda (3-5 agenda items)
3. Key talking points (3-5 points)

Respond with ONLY valid JSON (no markdown):
{
  "checkInEmail": {
    "subject": "<email subject>",
    "body": "<email body - professional and warm tone>"
  },
  "qbrAgenda": ["<agenda item 1>", "<agenda item 2>", ...],
  "talkingPoints": ["<point 1>", "<point 2>", ...]
}`;

    try {
      const message = await createMessageWithRetry(
        this.client,
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        '[churn-prediction-agent/save-plan]'
      );

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[churn-prediction-agent] JSON.parse failed:', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseTextPreview: responseText.slice(0, 500),
        });
      }

      return {
        id: `save_${input.clientId}_${Date.now()}`,
        clientId: input.clientId,
        status: 'draft',
        checkInEmail: parsed.checkInEmail || { subject: 'Check-in', body: '' },
        qbrAgenda: parsed.qbrAgenda || [],
        talkingPoints: parsed.talkingPoints || [],
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating save plan:', error);
      // Return a basic save plan on error
      return {
        id: `save_${input.clientId}_${Date.now()}`,
        clientId: input.clientId,
        status: 'draft',
        checkInEmail: { subject: 'Check-in with your account team', body: 'Let\'s schedule a time to discuss your needs.' },
        qbrAgenda: ['Quarterly Business Review', 'Account Performance Review', 'Q&A and Discussion'],
        talkingPoints: ['Partnership value', 'Recent wins', 'Future roadmap'],
        createdAt: new Date().toISOString(),
      };
    }
  }
}

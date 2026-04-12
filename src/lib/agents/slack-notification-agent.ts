/**
 * Slack Notification Agent
 *
 * Sends formatted notifications to Slack via incoming webhooks.
 * Uses Slack Block Kit for rich, structured message formatting.
 *
 * Supports:
 * - Monday Brief summaries (portfolio health, at-risk clients, suggested actions)
 * - Churn risk alerts (when client crosses threshold)
 * - Upsell opportunity notifications
 * - Health score drop alerts
 * - Team notifications (new member joined, client assignment changes)
 */

// ─── Types ─────────────────────────────────────────────────────────

/**
 * Slack Block Kit block types we use for rich formatting
 * See: https://api.slack.com/block-kit/building
 */
interface SlackBlock {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * A Slack message payload with blocks
 */
interface SlackMessage {
  blocks: SlackBlock[];
  text?: string; // Fallback plain text for notifications
}

// ─── Message Input Types ───────────────────────────────────────────

export interface MondayBriefNotification {
  type: 'monday_brief';
  agencyName: string;
  weekOf: string;
  totalClients: number;
  healthy: number;
  atRisk: number;
  critical: number;
  averageScore: number;
  weekDelta: number;
  needsAttentionCount: number;
  topActionItem?: string;
  dashboardLink?: string;
}

export interface ChurnAlertNotification {
  type: 'churn_alert';
  clientName: string;
  companyName: string;
  churnProbability: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  primaryRiskFactors: string[];
  suggestedAction: string;
  dashboardLink?: string;
}

export interface UpsellOpportunityNotification {
  type: 'upsell_opportunity';
  clientName: string;
  companyName: string;
  healthScore: number;
  opportunityType: string;
  rationale: string;
  estimatedUpside?: string;
  dashboardLink?: string;
}

export interface HealthDropAlertNotification {
  type: 'health_drop_alert';
  clientName: string;
  companyName: string;
  currentScore: number;
  previousScore: number;
  scoreDrop: number;
  topDrivingFactor: string;
  suggestedAction: string;
  dashboardLink?: string;
}

export interface TeamNotification {
  type: 'team_event';
  eventType: 'member_joined' | 'member_left' | 'assignment_change';
  message: string;
  details?: Record<string, string>;
}

export type NotificationPayload =
  | MondayBriefNotification
  | ChurnAlertNotification
  | UpsellOpportunityNotification
  | HealthDropAlertNotification
  | TeamNotification;

// ─── Agent ─────────────────────────────────────────────────────────

export class SlackNotificationAgent {
  constructor(private readonly webhookUrl: string) {
    if (!webhookUrl) {
      throw new Error('webhookUrl is required');
    }
  }

  /**
   * Send a notification to Slack
   * @param notification The notification payload
   * @returns True if successful, false otherwise
   */
  async send(notification: NotificationPayload): Promise<boolean> {
    try {
      const message = this.buildMessage(notification);
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error(`Slack webhook failed: ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  /**
   * Build a Slack message from a notification payload
   */
  private buildMessage(notification: NotificationPayload): SlackMessage {
    switch (notification.type) {
      case 'monday_brief':
        return this.buildMondayBriefMessage(notification);
      case 'churn_alert':
        return this.buildChurnAlertMessage(notification);
      case 'upsell_opportunity':
        return this.buildUpsellMessage(notification);
      case 'health_drop_alert':
        return this.buildHealthDropMessage(notification);
      case 'team_event':
        return this.buildTeamEventMessage(notification);
      default:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error(`Unknown notification type: ${(notification as any).type}`);
    }
  }

  /**
   * Build Monday Brief message
   * Shows portfolio health snapshot and top action items
   */
  private buildMondayBriefMessage(n: MondayBriefNotification): SlackMessage {
    const deltaLabel = n.weekDelta > 0
      ? `+${n.weekDelta}`
      : n.weekDelta < 0
        ? `${n.weekDelta}`
        : '0';
    const deltaEmoji = n.weekDelta > 0 ? ':arrow_up:' : n.weekDelta < 0 ? ':arrow_down:' : '';

    const criticalEmoji = n.critical > 0 ? ':exclamation:' : '';
    const atRiskEmoji = n.atRisk > 0 ? ':warning:' : '';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Monday Brief',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Week of ${n.weekOf}* | ${n.agencyName}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Clients*\n${n.totalClients}`,
          },
          {
            type: 'mrkdwn',
            text: `*Avg Health*\n${n.averageScore} ${deltaEmoji} ${deltaLabel}`,
          },
          {
            type: 'mrkdwn',
            text: `*Healthy* :green_heart:\n${n.healthy}`,
          },
          {
            type: 'mrkdwn',
            text: `*At-Risk* :yellow_heart:\n${n.atRisk}`,
          },
          {
            type: 'mrkdwn',
            text: `${criticalEmoji} *Critical*\n${n.critical}`,
          },
          {
            type: 'mrkdwn',
            text: `*Needs Attention*\n${n.needsAttentionCount}`,
          },
        ],
      },
      {
        type: 'divider',
      },
    ];

    if (n.topActionItem) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Action*\n${n.topActionItem}`,
        },
      });
      blocks.push({
        type: 'divider',
      });
    }

    if (n.dashboardLink) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard',
              emoji: true,
            },
            url: n.dashboardLink,
            action_id: 'monday-brief-view',
          },
        ],
      });
    }

    return {
      blocks,
      text: `Monday Brief - Week of ${n.weekOf}`,
    };
  }

  /**
   * Build Churn Alert message
   * Highlights client at risk with risk factors and suggested actions
   */
  private buildChurnAlertMessage(n: ChurnAlertNotification): SlackMessage {
    const riskEmoji: Record<string, string> = {
      critical: ':exclamation:',
      high: ':warning:',
      moderate: ':grey_question:',
      low: ':white_check_mark:',
    };

    const riskColor: Record<string, string> = {
      critical: '#c82333',
      high: '#ff9900',
      moderate: '#ffb81c',
      low: '#4caf50',
    };

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${riskEmoji[n.riskLevel]} Churn Risk Alert`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${n.companyName || n.clientName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Churn Probability*\n${n.churnProbability}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Risk Level*\n${n.riskLevel.toUpperCase()}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Primary Risk Factors*\n${n.primaryRiskFactors.map((f) => `• ${f}`).join('\n')}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Suggested Action*\n${n.suggestedAction}`,
        },
      },
    ];

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Risk level: ${n.riskLevel} | Action needed immediately`,
        },
      ],
    });

    if (n.dashboardLink) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review Client',
              emoji: true,
            },
            url: n.dashboardLink,
            action_id: 'churn-alert-view',
            style: 'danger',
          },
        ],
      });
    }

    return {
      blocks,
      text: `Churn Risk Alert: ${n.companyName || n.clientName} (${n.churnProbability}%)`,
    };
  }

  /**
   * Build Upsell Opportunity message
   * Highlights client with positive momentum and expansion potential
   */
  private buildUpsellMessage(n: UpsellOpportunityNotification): SlackMessage {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':moneybag: Upsell Opportunity',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${n.companyName || n.clientName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Health Score*\n${n.healthScore}/100`,
          },
          {
            type: 'mrkdwn',
            text: `*Opportunity*\n${n.opportunityType}`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${n.rationale}`,
        },
      },
    ];

    if (n.estimatedUpside) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Estimated upside: ${n.estimatedUpside}`,
          },
        ],
      });
    }

    if (n.dashboardLink) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Explore Opportunity',
              emoji: true,
            },
            url: n.dashboardLink,
            action_id: 'upsell-view',
            style: 'primary',
          },
        ],
      });
    }

    return {
      blocks,
      text: `Upsell Opportunity: ${n.companyName || n.clientName}`,
    };
  }

  /**
   * Build Health Score Drop Alert message
   * Warns about sudden decrease in client health
   */
  private buildHealthDropMessage(n: HealthDropAlertNotification): SlackMessage {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':chart_with_downwards_trend: Health Score Drop',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${n.companyName || n.clientName}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Previous Score*\n${n.previousScore}/100`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Score*\n${n.currentScore}/100`,
          },
          {
            type: 'mrkdwn',
            text: `*Drop*\n-${n.scoreDrop} pts`,
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Factor*\n${n.topDrivingFactor}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Next Steps*\n${n.suggestedAction}`,
        },
      },
    ];

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Significant drop detected | Review and address immediately`,
        },
      ],
    });

    if (n.dashboardLink) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true,
            },
            url: n.dashboardLink,
            action_id: 'health-drop-view',
            style: 'danger',
          },
        ],
      });
    }

    return {
      blocks,
      text: `Health Score Drop: ${n.companyName || n.clientName} (${n.previousScore} → ${n.currentScore})`,
    };
  }

  /**
   * Build Team Event message
   * Notifies about team member changes or assignment updates
   */
  private buildTeamEventMessage(n: TeamNotification): SlackMessage {
    const eventEmoji: Record<string, string> = {
      member_joined: ':tada:',
      member_left: ':wave:',
      assignment_change: ':handshake:',
    };

    const eventLabel: Record<string, string> = {
      member_joined: 'Team Member Joined',
      member_left: 'Team Member Left',
      assignment_change: 'Client Assignment',
    };

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${eventEmoji[n.eventType]} ${eventLabel[n.eventType]}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: n.message,
        },
      },
    ];

    if (n.details && Object.keys(n.details).length > 0) {
      const detailsText = Object.entries(n.details)
        .map(([key, value]) => `*${key}*: ${value}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: detailsText,
        },
      });
    }

    return {
      blocks,
      text: eventLabel[n.eventType],
    };
  }
}

// ─── Helper Functions ──────────────────────────────────────────────

/**
 * Create an agent for a webhook URL and send a notification
 */
export async function sendSlackNotification(
  webhookUrl: string,
  notification: NotificationPayload
): Promise<boolean> {
  const agent = new SlackNotificationAgent(webhookUrl);
  return agent.send(notification);
}

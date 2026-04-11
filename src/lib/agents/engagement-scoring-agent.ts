/**
 * Engagement Scoring Agent — Sprint 5 (Task 5.4)
 *
 * Computes a composite engagement score (0-100) from calendar and email signals.
 * This replaces the simple meeting-recency heuristic from Health Score v1 with
 * a multi-signal engagement dimension fed by real Calendar + Gmail data.
 *
 * Weights:
 *   Calendar signals: 60% (meeting frequency, cadence, attendee engagement, recency)
 *   Email signals:    40% (volume trend, response time, client responsiveness)
 *
 * When only one data source is available, that source gets 100% weight.
 * When neither is available, falls back to the v1 heuristic (meeting recency + trend).
 */

import {
  ClientCalendarMetrics,
  ClientEmailMetrics,
  EngagementMetrics,
  EngagementScoreInput,
} from '@/types/integrations';

const CALENDAR_WEIGHT = 0.6;
const EMAIL_WEIGHT = 0.4;

export class EngagementScoringAgent {
  /**
   * Compute full engagement metrics from calendar + email data
   */
  computeEngagementScore(
    clientId: string,
    agencyId: string,
    input: EngagementScoreInput
  ): EngagementMetrics {
    const hasCalendar = !!input.calendarMetrics;
    const hasEmail = !!input.emailMetrics;

    let calendarScore = 50;
    let emailScore = 50;
    let overallScore: number;

    // ── Calendar sub-score ──────────────────────────────────────
    if (hasCalendar) {
      calendarScore = this.computeCalendarSubScore(input.calendarMetrics!);
    } else if (input.lastMeetingDaysAgo !== undefined) {
      // Fallback: v1-style heuristic from manual meeting uploads
      calendarScore = this.computeFallbackCalendarScore(
        input.meetingFrequencyTrend || 'stable',
        input.lastMeetingDaysAgo
      );
    }

    // ── Email sub-score ─────────────────────────────────────────
    if (hasEmail) {
      emailScore = this.computeEmailSubScore(input.emailMetrics!);
    }

    // ── Weighted composite ──────────────────────────────────────
    if (hasCalendar && hasEmail) {
      overallScore =
        calendarScore * CALENDAR_WEIGHT + emailScore * EMAIL_WEIGHT;
    } else if (hasCalendar) {
      overallScore = calendarScore;
    } else if (hasEmail) {
      overallScore = emailScore;
    } else {
      // Neither connected — use calendar fallback as overall
      overallScore = calendarScore;
    }

    const cal = input.calendarMetrics;
    const em = input.emailMetrics;

    return {
      clientId,
      agencyId,
      calendarScore: Math.round(calendarScore),
      meetingFrequency: cal?.avgMeetingsPerWeek ?? 0,
      meetingFrequencyTrend:
        cal?.meetingFrequencyTrend ??
        input.meetingFrequencyTrend ??
        'stable',
      lastMeetingDaysAgo:
        cal
          ? cal.lastMeetingDate
            ? Math.floor(
                (Date.now() - new Date(cal.lastMeetingDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 999
          : input.lastMeetingDaysAgo ?? 999,
      nextMeetingDaysAway: cal?.nextScheduledMeeting
        ? Math.max(
            0,
            Math.floor(
              (new Date(cal.nextScheduledMeeting).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : undefined,
      attendeeEngagement: cal?.attendeeEngagement ?? 0,
      cadenceRegularity: cal?.cadenceScore ?? 0,
      emailScore: Math.round(emailScore),
      emailVolumeTrend: em?.volumeTrend ?? 'stable',
      avgResponseTimeHours: em?.avgResponseTimeHours ?? 0,
      clientResponsiveness: hasEmail
        ? this.computeClientResponsiveness(em!)
        : 0,
      overallEngagementScore: Math.round(overallScore),
      computedAt: new Date().toISOString(),
    };
  }

  // ── Calendar sub-score components ─────────────────────────────

  private computeCalendarSubScore(cal: ClientCalendarMetrics): number {
    // Sub-components (each 0-100):
    // 1. Recency (25%): How recently was the last meeting?
    let recencyScore = 100;
    if (cal.lastMeetingDate) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(cal.lastMeetingDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysAgo <= 7) recencyScore = 100;
      else if (daysAgo <= 14) recencyScore = 85;
      else if (daysAgo <= 21) recencyScore = 70;
      else if (daysAgo <= 30) recencyScore = 55;
      else if (daysAgo <= 60) recencyScore = 30;
      else recencyScore = 10;
    } else {
      recencyScore = 10;
    }

    // 2. Frequency (25%): Meetings per week (ideal: 0.5-2/week for agency clients)
    let frequencyScore = 50;
    const freq = cal.avgMeetingsPerWeek;
    if (freq >= 0.5 && freq <= 2) frequencyScore = 90;
    else if (freq >= 0.25 && freq < 0.5) frequencyScore = 70;
    else if (freq > 2 && freq <= 3) frequencyScore = 75;
    else if (freq > 3) frequencyScore = 60; // Too many meetings can signal problems
    else if (freq > 0) frequencyScore = 40;
    else frequencyScore = 10;

    // 3. Trend (20%): Is the meeting cadence improving or declining?
    let trendScore = 50;
    if (cal.meetingFrequencyTrend === 'increasing') trendScore = 85;
    else if (cal.meetingFrequencyTrend === 'stable') trendScore = 70;
    else trendScore = 30;

    // 4. Attendee engagement (15%)
    const attendeeScore = cal.attendeeEngagement;

    // 5. Cadence regularity (15%)
    const cadenceScore = cal.cadenceScore;

    return (
      recencyScore * 0.25 +
      frequencyScore * 0.25 +
      trendScore * 0.2 +
      attendeeScore * 0.15 +
      cadenceScore * 0.15
    );
  }

  // ── Email sub-score components ────────────────────────────────

  private computeEmailSubScore(em: ClientEmailMetrics): number {
    // Sub-components:
    // 1. Volume (30%): Are emails flowing?
    let volumeScore = 50;
    if (em.totalThreads30d >= 10) volumeScore = 90;
    else if (em.totalThreads30d >= 5) volumeScore = 75;
    else if (em.totalThreads30d >= 2) volumeScore = 55;
    else if (em.totalThreads30d >= 1) volumeScore = 35;
    else volumeScore = 10;

    // 2. Volume trend (20%)
    let trendScore = 50;
    if (em.volumeTrend === 'increasing') trendScore = 85;
    else if (em.volumeTrend === 'stable') trendScore = 65;
    else trendScore = 30;

    // 3. Response time (30%): Agency's responsiveness to client
    let responseScore = 50;
    if (em.avgResponseTimeHours <= 2) responseScore = 100;
    else if (em.avgResponseTimeHours <= 6) responseScore = 85;
    else if (em.avgResponseTimeHours <= 12) responseScore = 70;
    else if (em.avgResponseTimeHours <= 24) responseScore = 55;
    else if (em.avgResponseTimeHours <= 48) responseScore = 35;
    else responseScore = 15;

    // 4. Client responsiveness (20%)
    const clientResp = this.computeClientResponsiveness(em);

    return (
      volumeScore * 0.3 +
      trendScore * 0.2 +
      responseScore * 0.3 +
      clientResp * 0.2
    );
  }

  private computeClientResponsiveness(em: ClientEmailMetrics): number {
    // Based on client's average response time
    const hours = em.clientAvgResponseTimeHours;
    if (hours <= 4) return 100;
    if (hours <= 12) return 80;
    if (hours <= 24) return 60;
    if (hours <= 48) return 40;
    if (hours <= 72) return 25;
    return 10;
  }

  // ── Fallback: v1-style heuristic ──────────────────────────────

  private computeFallbackCalendarScore(
    trend: 'increasing' | 'stable' | 'declining',
    lastMeetingDaysAgo: number
  ): number {
    let recencyScore = 100;
    if (lastMeetingDaysAgo <= 7) recencyScore = 100;
    else if (lastMeetingDaysAgo <= 14) recencyScore = 85;
    else if (lastMeetingDaysAgo <= 30) recencyScore = 60;
    else if (lastMeetingDaysAgo <= 60) recencyScore = 30;
    else recencyScore = 10;

    let frequencyScore = 50;
    if (trend === 'increasing') frequencyScore = 85;
    else if (trend === 'stable') frequencyScore = 70;
    else frequencyScore = 40;

    return (recencyScore + frequencyScore) / 2;
  }
}

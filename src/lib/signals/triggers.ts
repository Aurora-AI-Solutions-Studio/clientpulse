// RF→CP Signal Pipeline — APE auto-trigger rules.
//
// Pure decision function: given a freshly-arrived client_signal and the
// previous-period value for the same signal_type, decide whether the
// Action Proposal Engine should auto-create a re-engagement action_item
// and what that item should say.
//
// Two trigger conditions today:
//
//   1) pause_resume = 1.0
//      RF marks a client as paused when their publishing has stopped
//      across the latest period. Always create.
//
//   2) content_velocity dropped >= 60% week-over-week
//      Catches sliding-into-paused before pause_resume flips. Skipped
//      when there's no prior period (a brand-new client) or the prior
//      value was 0 (already paused).
//
// Future signal types stay no-op until we explicitly add their rule —
// safer than auto-firing on any drop.

export type SignalType =
  | 'content_velocity'
  | 'approval_latency'
  | 'pause_resume'
  | 'voice_freshness'
  | 'ingestion_rate'
  | 'engagement_velocity';

export interface SignalTriggerContext {
  signalType: SignalType;
  value: number;
  prevValue: number | null;
  clientName: string;
}

export type SignalTriggerReason = 'paused' | 'velocity_drop';

export interface SignalTriggerHit {
  shouldCreate: true;
  reason: SignalTriggerReason;
  title: string;
  description: string;
}

export interface SignalTriggerMiss {
  shouldCreate: false;
}

export type SignalTriggerResult = SignalTriggerHit | SignalTriggerMiss;

export const VELOCITY_DROP_THRESHOLD = 0.6;

export function evaluateSignalTrigger(
  ctx: SignalTriggerContext
): SignalTriggerResult {
  const name = ctx.clientName.trim() || 'this client';

  if (ctx.signalType === 'pause_resume' && ctx.value === 1) {
    return {
      shouldCreate: true,
      reason: 'paused',
      title: `Re-engage ${name} — publishing has paused`,
      description:
        `${name} hasn't published any new content in the latest period. ` +
        `Reach out to understand the cause and offer support before they ` +
        `fully disengage.`,
    };
  }

  if (
    ctx.signalType === 'content_velocity' &&
    ctx.prevValue !== null &&
    ctx.prevValue > 0
  ) {
    const dropPct = (ctx.prevValue - ctx.value) / ctx.prevValue;
    if (dropPct >= VELOCITY_DROP_THRESHOLD) {
      const dropDisplay = Math.round(dropPct * 100);
      return {
        shouldCreate: true,
        reason: 'velocity_drop',
        title: `Re-engage ${name} — output dropped ${dropDisplay}% week-over-week`,
        description:
          `${name}'s publishing rate fell from ${ctx.prevValue} to ${ctx.value} ` +
          `pieces. Reach out before momentum collapses.`,
      };
    }
  }

  return { shouldCreate: false };
}

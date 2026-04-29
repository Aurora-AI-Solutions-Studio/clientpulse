import { describe, expect, it } from 'vitest';
import {
  HealthScoringAgent,
  type HealthScoreInput,
} from '@/lib/agents/health-scoring-agent';

const baseInput: HealthScoreInput = {
  financialScore: 80,
  meetingSentimentScores: [8, 8, 8],
  actionItemStats: { total: 10, completed: 9, overdue: 0 },
  meetingFrequencyTrend: 'stable',
  lastMeetingDaysAgo: 5,
};

describe('HealthScoringAgent — signals dimension (slice 2B)', () => {
  it('omits the signals breakdown when no signalsInput is supplied', () => {
    const agent = new HealthScoringAgent();
    const result = agent.computeHealthScore(baseInput);
    expect(result.breakdown.signals).toBeUndefined();
  });

  it('preserves the original 4-dim weighting when signals are absent', () => {
    const agent = new HealthScoringAgent();
    const a = agent.computeHealthScore(baseInput);
    const b = agent.computeHealthScore({ ...baseInput });
    expect(a.overall).toBe(b.overall);
  });

  it('drops the overall sharply when pause_resume=1 (Cypress case)', () => {
    const agent = new HealthScoringAgent();
    const noSignals = agent.computeHealthScore(baseInput);
    const paused = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { pauseResume: 1 },
    });
    expect(paused.breakdown.signals).toBeDefined();
    expect(paused.breakdown.signals).toBeLessThan(15);
    expect(paused.overall).toBeLessThan(noSignals.overall - 10);
  });

  it('rewards strong content velocity', () => {
    const agent = new HealthScoringAgent();
    const baseline = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 2 },
    });
    const strong = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 5 },
    });
    expect(strong.breakdown.signals!).toBeGreaterThan(baseline.breakdown.signals!);
    expect(strong.overall).toBeGreaterThan(baseline.overall);
  });

  it('penalises stale voice profiles (>60 days)', () => {
    const agent = new HealthScoringAgent();
    const fresh = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3, voiceFreshnessDays: 5 },
    });
    const stale = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3, voiceFreshnessDays: 90 },
    });
    expect(stale.breakdown.signals!).toBeLessThan(fresh.breakdown.signals!);
  });

  it('emits a signals-typed HealthSignal in the explanation array', () => {
    const agent = new HealthScoringAgent();
    const result = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { pauseResume: 1 },
    });
    const signalsSig = result.signals.find((s) => s.type === 'signals');
    expect(signalsSig).toBeDefined();
    expect(signalsSig?.severity).toBe('high');
  });

  it('persists the signals number in the breakdown', () => {
    const agent = new HealthScoringAgent();
    const result = agent.computeHealthScore({
      ...baseInput,
      signalsInput: {
        contentVelocity: 4,
        voiceFreshnessDays: 10,
        approvalLatencyMs: 1000 * 60 * 60 * 24, // 1 day
        ingestionRate: 5,
      },
    });
    expect(typeof result.breakdown.signals).toBe('number');
    expect(result.breakdown.signals!).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.signals!).toBeLessThanOrEqual(100);
  });

  // Slice 6 — engagement_velocity dimension.
  it('rewards strong audience engagement (Slice 6)', () => {
    const agent = new HealthScoringAgent();
    const flat = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3, engagementVelocity: 0 },
    });
    const winning = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3, engagementVelocity: 25 },
    });
    expect(winning.breakdown.signals!).toBeGreaterThan(flat.breakdown.signals!);
    expect(winning.overall).toBeGreaterThan(flat.overall);
    const positiveSig = winning.signals.find(
      (s) => s.type === 'signals' && s.severity === 'positive',
    );
    expect(positiveSig).toBeDefined();
    expect(positiveSig?.message).toContain('Strong audience response');
  });

  it('penalises shipping with zero engagement (publishing into the void)', () => {
    const agent = new HealthScoringAgent();
    const baseline = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3 },
    });
    const flat = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 3, engagementVelocity: 0 },
    });
    expect(flat.breakdown.signals!).toBeLessThan(baseline.breakdown.signals!);
    const flatSig = flat.signals.find(
      (s) => s.type === 'signals' && (s.message ?? '').includes('zero audience engagement'),
    );
    expect(flatSig).toBeDefined();
  });

  it('does NOT penalise zero engagement when content_velocity is also zero (already paused)', () => {
    const agent = new HealthScoringAgent();
    const noVelocity = agent.computeHealthScore({
      ...baseInput,
      signalsInput: { contentVelocity: 0, engagementVelocity: 0 },
    });
    const flatSig = noVelocity.signals.find(
      (s) => s.type === 'signals' && (s.message ?? '').includes('zero audience engagement'),
    );
    expect(flatSig).toBeUndefined();
  });
});

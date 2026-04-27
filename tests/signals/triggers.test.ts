import { describe, expect, it } from 'vitest';
import {
  evaluateSignalTrigger,
  VELOCITY_DROP_THRESHOLD,
} from '@/lib/signals/triggers';

describe('evaluateSignalTrigger — pause_resume', () => {
  it('fires when value === 1', () => {
    const result = evaluateSignalTrigger({
      signalType: 'pause_resume',
      value: 1,
      prevValue: null,
      clientName: 'Cypress Logistics',
    });
    expect(result.shouldCreate).toBe(true);
    if (result.shouldCreate) {
      expect(result.reason).toBe('paused');
      expect(result.title).toContain('Cypress Logistics');
      expect(result.title.toLowerCase()).toContain('paused');
    }
  });

  it('does not fire when value === 0', () => {
    const result = evaluateSignalTrigger({
      signalType: 'pause_resume',
      value: 0,
      prevValue: null,
      clientName: 'Cypress Logistics',
    });
    expect(result.shouldCreate).toBe(false);
  });

  it('falls back to "this client" on empty name', () => {
    const result = evaluateSignalTrigger({
      signalType: 'pause_resume',
      value: 1,
      prevValue: null,
      clientName: '   ',
    });
    expect(result.shouldCreate).toBe(true);
    if (result.shouldCreate) expect(result.title).toContain('this client');
  });
});

describe('evaluateSignalTrigger — content_velocity drop', () => {
  it('fires when drop >= threshold', () => {
    const prev = 5;
    const curr = prev * (1 - VELOCITY_DROP_THRESHOLD - 0.01); // just over threshold
    const result = evaluateSignalTrigger({
      signalType: 'content_velocity',
      value: curr,
      prevValue: prev,
      clientName: 'Linden & Co',
    });
    expect(result.shouldCreate).toBe(true);
    if (result.shouldCreate) {
      expect(result.reason).toBe('velocity_drop');
      expect(result.title).toContain('Linden & Co');
      expect(result.title).toMatch(/dropped \d+%/);
    }
  });

  it('does not fire on small drops', () => {
    const result = evaluateSignalTrigger({
      signalType: 'content_velocity',
      value: 4,
      prevValue: 5, // 20% drop
      clientName: 'Helios',
    });
    expect(result.shouldCreate).toBe(false);
  });

  it('does not fire when prev is 0 (already paused)', () => {
    const result = evaluateSignalTrigger({
      signalType: 'content_velocity',
      value: 0,
      prevValue: 0,
      clientName: 'X',
    });
    expect(result.shouldCreate).toBe(false);
  });

  it('does not fire when prev is null (brand new client)', () => {
    const result = evaluateSignalTrigger({
      signalType: 'content_velocity',
      value: 0,
      prevValue: null,
      clientName: 'X',
    });
    expect(result.shouldCreate).toBe(false);
  });
});

describe('evaluateSignalTrigger — non-trigger signal types', () => {
  it.each(['approval_latency', 'voice_freshness', 'ingestion_rate'] as const)(
    'never fires on %s',
    (signalType) => {
      const result = evaluateSignalTrigger({
        signalType,
        value: 999,
        prevValue: 0,
        clientName: 'X',
      });
      expect(result.shouldCreate).toBe(false);
    }
  );
});

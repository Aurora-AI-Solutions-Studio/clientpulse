import { describe, expect, it } from 'vitest';
import {
  shouldSendMondayBrief,
  DEFAULT_TIMEZONE,
  DEFAULT_BRIEF_SEND_HOUR,
} from '@/lib/brief/schedule';

// Helper: build a UTC Date for an exact ISO instant.
const utc = (iso: string) => new Date(iso);

describe('shouldSendMondayBrief', () => {
  it('fires at 8AM local Monday for an Eastern-time user (winter EST = UTC-5)', () => {
    // Mon 2026-02-02 08:00 EST = Mon 2026-02-02 13:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-02T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(true);
  });

  it('fires at 8AM local Monday for an Eastern-time user (summer EDT = UTC-4)', () => {
    // Mon 2026-07-06 08:00 EDT = Mon 2026-07-06 12:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-07-06T12:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(true);
  });

  it('fires at 8AM local Monday for a Pacific-time user (PST = UTC-8)', () => {
    // Mon 2026-02-02 08:00 PST = Mon 2026-02-02 16:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-02T16:00:00Z'), {
        timezone: 'America/Los_Angeles',
        briefSendHour: 8,
      }),
    ).toBe(true);
  });

  it("does NOT fire for an LA user at the East Coast 8AM tick", () => {
    // Mon 2026-02-02 13:00 UTC is 05:00 PST — not yet 8 AM in LA
    expect(
      shouldSendMondayBrief(utc('2026-02-02T13:00:00Z'), {
        timezone: 'America/Los_Angeles',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('fires for a Berlin user at 8AM CET', () => {
    // Mon 2026-02-02 08:00 CET = Mon 2026-02-02 07:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-02T07:00:00Z'), {
        timezone: 'Europe/Berlin',
        briefSendHour: 8,
      }),
    ).toBe(true);
  });

  it('crosses the dateline correctly: NZ user fires Sunday-UTC for their Monday', () => {
    // Mon 2026-02-02 08:00 NZDT (UTC+13) = Sun 2026-02-01 19:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-01T19:00:00Z'), {
        timezone: 'Pacific/Auckland',
        briefSendHour: 8,
      }),
    ).toBe(true);
    // Same UTC tick is NOT Monday for any America/ user
    expect(
      shouldSendMondayBrief(utc('2026-02-01T19:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('does not fire on Tuesday at the same local hour', () => {
    // Tue 2026-02-03 08:00 EST = Tue 2026-02-03 13:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-03T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('does not fire on Sunday at the same local hour', () => {
    // Sun 2026-02-01 08:00 EST = Sun 2026-02-01 13:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-01T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('handles spring-forward DST (US 2026-03-08): 8AM EDT same as 12:00 UTC, no double-fire', () => {
    // Sunday 2026-03-08 02:00 EST → 03:00 EDT (lose 1 hour)
    // Following Monday 2026-03-09 08:00 EDT = 12:00 UTC (one tick)
    expect(
      shouldSendMondayBrief(utc('2026-03-09T12:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(true);
    // 13:00 UTC is 09:00 EDT — should not fire
    expect(
      shouldSendMondayBrief(utc('2026-03-09T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('handles fall-back DST (US 2026-11-01): 8AM EST = 13:00 UTC, no double-fire', () => {
    // Sunday 2026-11-01 02:00 EDT → 01:00 EST (gain 1 hour)
    // Following Monday 2026-11-02 08:00 EST = 13:00 UTC (one tick)
    expect(
      shouldSendMondayBrief(utc('2026-11-02T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(true);
    // 12:00 UTC is 07:00 EST — should not fire
    expect(
      shouldSendMondayBrief(utc('2026-11-02T12:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 8,
      }),
    ).toBe(false);
  });

  it('respects a non-default send hour (10AM)', () => {
    // Mon 2026-02-02 10:00 EST = Mon 2026-02-02 15:00 UTC
    expect(
      shouldSendMondayBrief(utc('2026-02-02T15:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 10,
      }),
    ).toBe(true);
    // 13:00 UTC = 8 AM EST — should NOT fire for a 10AM user
    expect(
      shouldSendMondayBrief(utc('2026-02-02T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 10,
      }),
    ).toBe(false);
  });

  it('rejects out-of-range send hours', () => {
    expect(
      shouldSendMondayBrief(utc('2026-02-02T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: 24,
      }),
    ).toBe(false);
    expect(
      shouldSendMondayBrief(utc('2026-02-02T13:00:00Z'), {
        timezone: 'America/New_York',
        briefSendHour: -1,
      }),
    ).toBe(false);
  });

  it('exports defaults that match the migration', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/New_York');
    expect(DEFAULT_BRIEF_SEND_HOUR).toBe(8);
  });
});

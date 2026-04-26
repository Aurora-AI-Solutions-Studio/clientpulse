import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PER_CLIENT_TAB,
  PER_CLIENT_TABS,
  parsePerClientTab,
} from '../../src/lib/clients/tabs';

describe('per-client tabs', () => {
  it('exposes the locked tab set in the locked order', () => {
    expect(PER_CLIENT_TABS).toEqual([
      'signals',
      'actions',
      'health',
      'predictions',
      'alerts',
    ]);
  });

  it('default tab is signals', () => {
    expect(DEFAULT_PER_CLIENT_TAB).toBe('signals');
  });

  it('parses each valid tab unchanged', () => {
    for (const t of PER_CLIENT_TABS) {
      expect(parsePerClientTab(t)).toBe(t);
    }
  });

  it('falls back to default for null / undefined / unknown', () => {
    expect(parsePerClientTab(null)).toBe(DEFAULT_PER_CLIENT_TAB);
    expect(parsePerClientTab(undefined)).toBe(DEFAULT_PER_CLIENT_TAB);
    expect(parsePerClientTab('not-a-tab')).toBe(DEFAULT_PER_CLIENT_TAB);
    expect(parsePerClientTab('')).toBe(DEFAULT_PER_CLIENT_TAB);
  });
});

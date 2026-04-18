import { describe, expect, it } from 'vitest';
import { MODELS, getModel, listModels, listModelsByProvider } from '@/lib/llm/models';

describe('lib/llm/models — catalog integrity', () => {
  it('every catalog entry has a matching id field (no accidental rename drift)', () => {
    for (const [key, descriptor] of Object.entries(MODELS)) {
      expect(descriptor.id).toBe(key);
    }
  });

  it('every model has a non-empty vendorId', () => {
    for (const m of listModels()) {
      expect(m.vendorId.length).toBeGreaterThan(0);
    }
  });

  it('every model has a positive context window and non-negative pricing', () => {
    for (const m of listModels()) {
      expect(m.context_window).toBeGreaterThan(0);
      expect(m.cost_per_mtok_input).toBeGreaterThanOrEqual(0);
      expect(m.cost_per_mtok_output).toBeGreaterThanOrEqual(0);
    }
  });

  it('getModel throws for unknown ids and returns for known ones', () => {
    expect(getModel('claude-sonnet-4-5').provider).toBe('anthropic');
    // @ts-expect-error — testing the guard
    expect(() => getModel('nonexistent-model')).toThrow(/Unknown model/);
  });

  it('listModelsByProvider partitions the catalog', () => {
    const anthropic = listModelsByProvider('anthropic');
    const openai = listModelsByProvider('openai');
    const google = listModelsByProvider('google');
    expect(anthropic.length + openai.length + google.length).toBe(listModels().length);
    expect(anthropic.every((m) => m.provider === 'anthropic')).toBe(true);
    expect(openai.every((m) => m.provider === 'openai')).toBe(true);
    expect(google.every((m) => m.provider === 'google')).toBe(true);
  });

  it('exactly one model is flagged as the Solo-tier default (gpt-4o-mini)', () => {
    const defaults = listModels().filter((m) => m.is_tier_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('gpt-4o-mini');
    expect(defaults[0].min_tier).toBe('starter');
  });
});

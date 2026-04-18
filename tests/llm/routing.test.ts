import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODELS,
  getAvailableModels,
  resolveModel,
  tierMeetsMin,
} from '@/lib/llm/routing';
import { LLMTierGateError } from '@/lib/llm/types';

describe('lib/llm/routing — tier gating', () => {
  describe('tierMeetsMin', () => {
    it('respects the tier ladder', () => {
      expect(tierMeetsMin('starter', 'starter')).toBe(true);
      expect(tierMeetsMin('pro', 'starter')).toBe(true);
      expect(tierMeetsMin('agency', 'pro')).toBe(true);
      expect(tierMeetsMin('pro', 'agency')).toBe(false);
      expect(tierMeetsMin('starter', 'pro')).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('Starter (Solo) sees only tier-starter models', () => {
      const models = getAvailableModels('starter');
      expect(models.every((m) => m.min_tier === 'starter')).toBe(true);
      expect(models.some((m) => m.id === 'gpt-4o-mini')).toBe(true);
      expect(models.some((m) => m.id === 'claude-sonnet-4-5')).toBe(false);
    });

    it('Pro sees all Pro-tier and below', () => {
      const models = getAvailableModels('pro');
      expect(models.some((m) => m.id === 'claude-sonnet-4-5')).toBe(true);
      expect(models.some((m) => m.id === 'gemini-flash-lite-2-5')).toBe(true);
    });

    it('Agency sees everything Pro does plus any agency-only entries', () => {
      const proCount = getAvailableModels('pro').length;
      const agencyCount = getAvailableModels('agency').length;
      expect(agencyCount).toBeGreaterThanOrEqual(proCount);
    });
  });

  describe('resolveModel — Starter (Solo) is locked', () => {
    it('returns gpt-4o-mini even when no model is requested', () => {
      const r = resolveModel('starter');
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.reason).toBe('tier-default');
    });

    it('substitutes a requested higher-tier model for the default', () => {
      const r = resolveModel('starter', { requested: 'claude-sonnet-4-5' });
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.substituted).toBe(true);
      expect(r.reason).toBe('tier-substitution');
    });

    it('does not substitute when the request already matches the default', () => {
      const r = resolveModel('starter', { requested: 'gpt-4o-mini' });
      expect(r.model).toBe('gpt-4o-mini');
      expect(r.substituted).toBe(false);
    });
  });

  describe('resolveModel — Pro honors explicit requests', () => {
    it('returns the default when no model is requested', () => {
      const r = resolveModel('pro');
      expect(r.model).toBe(DEFAULT_MODELS.pro);
    });

    it('returns the requested model when eligible', () => {
      const r = resolveModel('pro', { requested: 'gemini-flash-lite-2-5' });
      expect(r.model).toBe('gemini-flash-lite-2-5');
      expect(r.substituted).toBe(false);
      expect(r.reason).toBe('explicit');
    });
  });

  describe('resolveModel — Agency auto-routing', () => {
    it('auto-picks the cheapest eligible model for a capability when no request is given', () => {
      const r = resolveModel('agency', { capability: 'scoring' });
      expect(r.reason).toBe('auto-route');
      // gemini-flash-lite-2-5 wins for "scoring" among the current catalog
      // (cheaper than gpt-4o-mini and haiku-4-5 on per-token input cost).
      expect(r.model).toBe('gemini-flash-lite-2-5');
    });

    it('still respects an explicit request on Agency', () => {
      const r = resolveModel('agency', {
        requested: 'claude-sonnet-4-5',
        capability: 'voice',
      });
      expect(r.model).toBe('claude-sonnet-4-5');
      expect(r.reason).toBe('explicit');
    });
  });

  describe('resolveModel — strict mode throws on tier miss', () => {
    it('throws LLMTierGateError when substituteOnTierMiss is false', () => {
      expect(() =>
        resolveModel('starter', {
          requested: 'claude-sonnet-4-5',
          substituteOnTierMiss: false,
        }),
      ).toThrow(LLMTierGateError);
    });
  });
});

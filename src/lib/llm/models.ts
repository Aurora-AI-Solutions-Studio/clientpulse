// ─── Model Catalog ────────────────────────────────────────────────
// The single source of truth for "what models exist and who can use them."
// Adding a new model is a one-line change here — no other module should
// hard-code vendor model strings.
//
// Ported from reforge/lib/llm/models.ts (Sprint 7.6 M1).

import type { LLMModelDescriptor, LLMModelId, LLMProviderId } from './types';

export const MODELS: Record<LLMModelId, LLMModelDescriptor> = {
  // ─── Anthropic ──────────────────────────────────────────────────
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    vendorId: 'claude-sonnet-4-5',
    min_tier: 'pro',
    capabilities: ['content', 'voice', 'reasoning', 'long-context', 'vision'],
    cost_per_mtok_input: 3.0,
    cost_per_mtok_output: 15.0,
    context_window: 200_000,
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    vendorId: 'claude-haiku-4-5-20251001',
    min_tier: 'pro',
    capabilities: ['content', 'scoring', 'voice'],
    cost_per_mtok_input: 1.0,
    cost_per_mtok_output: 5.0,
    context_window: 200_000,
  },

  // ─── OpenAI ─────────────────────────────────────────────────────
  'gpt-5-4': {
    id: 'gpt-5-4',
    provider: 'openai',
    vendorId: 'gpt-5-4',
    min_tier: 'pro',
    capabilities: ['content', 'voice', 'reasoning', 'long-context'],
    cost_per_mtok_input: 5.0,
    cost_per_mtok_output: 20.0,
    context_window: 128_000,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    vendorId: 'gpt-4o-mini',
    min_tier: 'solo',
    capabilities: ['content', 'scoring'],
    cost_per_mtok_input: 0.15,
    cost_per_mtok_output: 0.6,
    context_window: 128_000,
    is_tier_default: true,
  },

  // ─── Google ─────────────────────────────────────────────────────
  'gemini-flash-lite-2-5': {
    id: 'gemini-flash-lite-2-5',
    provider: 'google',
    vendorId: 'gemini-2.5-flash-lite',
    min_tier: 'pro',
    capabilities: ['content', 'scoring', 'long-context'],
    cost_per_mtok_input: 0.075,
    cost_per_mtok_output: 0.3,
    context_window: 1_000_000,
  },
};

export function getModel(id: LLMModelId): LLMModelDescriptor {
  const m = MODELS[id];
  if (!m) {
    throw new Error(`Unknown model: ${id}. Add it to src/lib/llm/models.ts.`);
  }
  return m;
}

export function listModels(): LLMModelDescriptor[] {
  return Object.values(MODELS);
}

export function listModelsByProvider(provider: LLMProviderId): LLMModelDescriptor[] {
  return Object.values(MODELS).filter((m) => m.provider === provider);
}

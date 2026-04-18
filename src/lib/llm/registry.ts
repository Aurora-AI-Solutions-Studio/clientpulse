// ─── LLMProviderRegistry ──────────────────────────────────────────
// Maps provider id → singleton BaseLLMProvider instance. All callers
// must go through this registry — never instantiate providers directly.
//
// Ported from reforge/lib/llm/registry.ts (Sprint 7.6 M1).

import type { BaseLLMProvider } from './base-provider';
import { AnthropicProvider } from './providers/anthropic';
import { GoogleProvider } from './providers/google';
import { OpenAIProvider } from './providers/openai';
import { getModel } from './models';
import type { LLMModelId, LLMProviderId } from './types';

export class LLMProviderRegistry {
  private readonly providers = new Map<LLMProviderId, BaseLLMProvider>();

  register(provider: BaseLLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: LLMProviderId): BaseLLMProvider {
    const p = this.providers.get(id);
    if (!p) {
      throw new Error(`No provider registered for ${id}. Call registry.register() first.`);
    }
    return p;
  }

  has(id: LLMProviderId): boolean {
    return this.providers.has(id);
  }

  /** Resolve the provider that can serve a given model. */
  getForModel(model: LLMModelId): BaseLLMProvider {
    const descriptor = getModel(model);
    return this.get(descriptor.provider);
  }

  listProviders(): LLMProviderId[] {
    // Array.from (vs spread) so this compiles against CP's default
    // `target` — CP's tsconfig doesn't opt into ES2015+ iteration.
    return Array.from(this.providers.keys());
  }
}

// ─── Default singleton ────────────────────────────────────────────
// `getDefaultRegistry()` lazily registers the three stock providers
// using env-var-backed credentials. In tests, construct a fresh
// `LLMProviderRegistry` and register mock providers instead.

let _defaultRegistry: LLMProviderRegistry | null = null;

export function getDefaultRegistry(): LLMProviderRegistry {
  if (!_defaultRegistry) {
    const r = new LLMProviderRegistry();
    r.register(new AnthropicProvider());
    r.register(new OpenAIProvider());
    r.register(new GoogleProvider());
    _defaultRegistry = r;
  }
  return _defaultRegistry;
}

/** Reset the cached default — test-only hook. */
export function __resetDefaultRegistryForTests(): void {
  _defaultRegistry = null;
}

// ─── High-level LLM client ────────────────────────────────────────
// Single entry point for the rest of the codebase. Call sites go from:
//
//    const response = await anthropic.messages.create({ model: '...', ... });
//
// to:
//
//    const response = await generateCompletion({
//      plan: user.plan,
//      request: { model: 'claude-sonnet-4-5', messages, max_tokens: 2048 },
//    });
//
// The router enforces tier gating before touching a provider — lower
// tiers can request anything and the router substitutes safely.
//
// Ported from contentpulse/lib/llm/client.ts (Sprint 7.6 M1).

import { getDefaultRegistry, type LLMProviderRegistry } from './registry';
import { resolveModel, type ResolveModelOptions } from './routing';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMTier,
} from './types';

export interface GenerateCompletionArgs {
  plan: LLMTier;
  request: Omit<LLMCompletionRequest, 'model'> & { model?: LLMCompletionRequest['model'] };
  /** Routing options (capability hint, substitute vs throw). */
  routing?: Omit<ResolveModelOptions, 'requested'>;
  /** Injection point for tests — defaults to the process-wide registry. */
  registry?: LLMProviderRegistry;
}

export interface GenerateCompletionResult extends LLMCompletionResponse {
  /** True if the router swapped the caller's model for a tier-appropriate one. */
  routed: boolean;
}

export async function generateCompletion(
  args: GenerateCompletionArgs,
): Promise<GenerateCompletionResult> {
  const { plan, request, routing, registry = getDefaultRegistry() } = args;

  const resolved = resolveModel(plan, { ...routing, requested: request.model });
  const provider = registry.getForModel(resolved.model);

  const response = await provider.generate({
    ...request,
    model: resolved.model,
  });

  return {
    ...response,
    routed: resolved.substituted || resolved.reason === 'auto-route',
  };
}

// ─── Backward-compat re-exports ───────────────────────────────────
// Convenience so call sites can import everything from one place.

export { getDefaultRegistry, LLMProviderRegistry } from './registry';
export { getAvailableModels, resolveModel, DEFAULT_MODELS } from './routing';
export { MODELS, getModel, listModels } from './models';
export type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  LLMModelId,
  LLMProviderId,
  LLMModelDescriptor,
  LLMCapability,
  LLMTier,
} from './types';
export { LLMError, LLMTierGateError } from './types';

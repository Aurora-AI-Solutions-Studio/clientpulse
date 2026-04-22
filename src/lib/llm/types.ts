// ─── Multi-Model LLM Abstraction — Sprint 8A M1 (ported from ReForge) ──
// Shared type surface for provider-agnostic LLM calls. The rest of the
// codebase should import from this module only — never reach into a
// concrete provider SDK directly.
//
// Ported from reforge/lib/llm/types.ts (Sprint 7.6 M1).
// CP adaptation: uses `SubscriptionPlan` (solo | pro | agency) from
// `@/types/stripe` instead of RF's 5-tier `LaunchPlan`.

import type { SubscriptionPlan } from '@/types/stripe';

// ─── Identity ─────────────────────────────────────────────────────

/** Vendor-neutral provider identifier. */
export type LLMProviderId = 'anthropic' | 'openai' | 'google';

/**
 * Internal model identifier. Decoupled from vendor model strings so that
 * bumping to a new Claude/GPT/Gemini version is a one-line change in the
 * catalog and nothing else.
 */
export type LLMModelId =
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5'
  | 'gpt-5-4'
  | 'gpt-4o-mini'
  | 'gemini-flash-lite-2-5';

// ─── Messages ─────────────────────────────────────────────────────

export type LLMRole = 'user' | 'assistant' | 'system';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

// ─── Requests & responses ─────────────────────────────────────────

export interface LLMCompletionRequest {
  /**
   * Preferred logical model. The router may substitute based on tier
   * gating — e.g. a Solo tier request for `claude-sonnet-4-5` will
   * be rewritten to `gpt-4o-mini` before reaching a provider.
   */
  model: LLMModelId;
  messages: LLMMessage[];
  /** Max tokens the provider may emit. Required — no secret defaults. */
  max_tokens: number;
  /** Optional system prompt. Providers without a system slot prepend it. */
  system?: string;
  temperature?: number;
  /** Opaque tag used for cost attribution + log correlation. */
  metadata?: Record<string, string>;
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMCompletionResponse {
  text: string;
  model: LLMModelId;
  provider: LLMProviderId;
  usage: LLMUsage;
  /** Provider-specific finish reason, normalized to lower-case. */
  stop_reason:
    | 'end_turn'
    | 'max_tokens'
    | 'stop_sequence'
    | 'content_filter'
    | 'tool_use'
    | 'unknown';
}

// ─── Capabilities & catalog entries ───────────────────────────────

/** Coarse capability tags used by the router for task-aware selection. */
export type LLMCapability =
  | 'content'        // general content generation
  | 'voice'          // voice/brand-rewrite quality
  | 'scoring'        // cheap classification / scoring
  | 'long-context'   // >64k effective context
  | 'reasoning'      // multi-step logical reasoning
  | 'vision';        // image input

/**
 * Tier string used by the LLM layer for gating. Aliased to CP's
 * `SubscriptionPlan` — keeping the type name separate so future tier
 * additions (e.g. 'free', 'enterprise') don't break LLM-internal code.
 */
export type LLMTier = SubscriptionPlan;

export interface LLMModelDescriptor {
  id: LLMModelId;
  provider: LLMProviderId;
  /** Exact vendor-side model string passed over the wire. */
  vendorId: string;
  /**
   * Minimum tier allowed to request this model. Tier gating is enforced
   * by `resolveModel()` before any provider call.
   */
  min_tier: LLMTier;
  capabilities: LLMCapability[];
  /** Approximate USD per 1M input tokens (for routing cost-awareness). */
  cost_per_mtok_input: number;
  /** Approximate USD per 1M output tokens. */
  cost_per_mtok_output: number;
  /** Context window in tokens. */
  context_window: number;
  /**
   * Default for a given tier when caller doesn't specify a model. The
   * router looks up `DEFAULT_MODELS[plan]` — see routing.ts.
   */
  is_tier_default?: boolean;
}

// ─── Errors ───────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProviderId,
    public readonly model: LLMModelId,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTierGateError extends Error {
  constructor(
    public readonly model: LLMModelId,
    public readonly plan: LLMTier,
    public readonly min_tier: LLMTier,
  ) {
    super(
      `Model ${model} requires tier ${min_tier} but caller is on ${plan}. ` +
      `Either upgrade plan or let the router substitute an eligible model.`,
    );
    this.name = 'LLMTierGateError';
  }
}

// ─── Tier-aware routing ───────────────────────────────────────────
// Canonical tier rules (Apr 14 Pricing Deep-Dive):
//   Starter  (= Solo) → GPT-4o-mini only (locked)
//   Pro              → all models, caller chooses
//   Agency           → all models + automatic cost/quality routing
//
// Ported from reforge/lib/llm/routing.ts (Sprint 7.6 M1).
// CP adaptation: 3-tier only (no 'free' or 'enterprise' in CP's plan).

import { MODELS, getModel } from './models';
import {
  LLMTierGateError,
  type LLMCapability,
  type LLMModelDescriptor,
  type LLMModelId,
  type LLMTier,
} from './types';

// ─── Tier ordering ────────────────────────────────────────────────

const TIER_RANK: Record<LLMTier, number> = {
  starter: 1, // Solo
  pro: 2,
  agency: 3,
};

export function tierMeetsMin(plan: LLMTier, min: LLMTier): boolean {
  return TIER_RANK[plan] >= TIER_RANK[min];
}

// ─── Per-tier defaults ────────────────────────────────────────────
// The default model picked when the caller doesn't specify one.
// Starter (Solo) is locked — the router NEVER substitutes something
// more expensive.

export const DEFAULT_MODELS: Record<LLMTier, LLMModelId> = {
  starter: 'gpt-4o-mini',
  pro: 'claude-sonnet-4-5',
  agency: 'claude-sonnet-4-5',
};

// ─── Available model set per tier ─────────────────────────────────

export function getAvailableModels(plan: LLMTier): LLMModelDescriptor[] {
  return Object.values(MODELS).filter((m) => tierMeetsMin(plan, m.min_tier));
}

// ─── Resolve a model: enforce tier gating + apply routing ─────────

export interface ResolveModelOptions {
  /**
   * What the caller asked for. Optional — when omitted we fall back to
   * the tier default.
   */
  requested?: LLMModelId;
  /**
   * Optional capability hint for Agency-tier auto-routing. When set on
   * an Agency plan, we pick the cheapest model that satisfies the cap.
   */
  capability?: LLMCapability;
  /**
   * When true (the default), requesting a locked-down tier model on a
   * lower tier rewrites the choice to the tier default instead of
   * throwing. Set false in API routes that want explicit 403s.
   */
  substituteOnTierMiss?: boolean;
}

export interface ResolvedModel {
  model: LLMModelId;
  /** True if the router picked something different from what was requested. */
  substituted: boolean;
  reason: 'explicit' | 'tier-default' | 'tier-substitution' | 'auto-route';
}

export function resolveModel(plan: LLMTier, opts: ResolveModelOptions = {}): ResolvedModel {
  const { requested, capability, substituteOnTierMiss = true } = opts;

  // Starter (Solo) is locked. Always return the default, regardless of
  // what was requested — this is the hard guarantee from the Pricing
  // Deep-Dive ("Solo = GPT-4o-mini, no substitutions").
  if (plan === 'starter') {
    const def = DEFAULT_MODELS[plan];
    if (requested && requested !== def) {
      if (!substituteOnTierMiss) {
        const descriptor = getModel(requested);
        throw new LLMTierGateError(requested, plan, descriptor.min_tier);
      }
      return { model: def, substituted: true, reason: 'tier-substitution' };
    }
    return { model: def, substituted: false, reason: 'tier-default' };
  }

  // Agency auto-routing: if the caller omitted an explicit model and
  // provided a capability hint, pick the cheapest eligible model.
  if (!requested && capability && plan === 'agency') {
    const eligible = getAvailableModels(plan)
      .filter((m) => m.capabilities.includes(capability))
      .sort((a, b) => a.cost_per_mtok_input - b.cost_per_mtok_input);
    if (eligible[0]) {
      return { model: eligible[0].id, substituted: false, reason: 'auto-route' };
    }
  }

  // Pro+ without a request: tier default.
  if (!requested) {
    return { model: DEFAULT_MODELS[plan], substituted: false, reason: 'tier-default' };
  }

  // Explicit request: enforce tier gating.
  const descriptor = getModel(requested);
  if (!tierMeetsMin(plan, descriptor.min_tier)) {
    if (substituteOnTierMiss) {
      return {
        model: DEFAULT_MODELS[plan],
        substituted: true,
        reason: 'tier-substitution',
      };
    }
    throw new LLMTierGateError(requested, plan, descriptor.min_tier);
  }
  return { model: requested, substituted: false, reason: 'explicit' };
}

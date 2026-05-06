// ─── BaseLLMProvider ──────────────────────────────────────────────
// Every concrete vendor adapter (Anthropic, OpenAI, Google) extends this
// base and implements `generate()`. The registry never talks to a vendor
// SDK directly — it goes through this contract.
//
// Ported from contentpulse/lib/llm/base-provider.ts (Sprint 7.6 M1).

import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProviderId,
} from './types';

export abstract class BaseLLMProvider {
  abstract readonly id: LLMProviderId;

  /**
   * Execute a completion. Implementations must:
   *  - Resolve the vendor-side model string from the catalog (do NOT
   *    accept a raw vendor id — always take an `LLMModelId`).
   *  - Translate `LLMMessage[]` → vendor message shape.
   *  - Translate vendor response → `LLMCompletionResponse` with
   *    normalized `stop_reason` and token usage filled in.
   *  - Throw `LLMError` on network / vendor failures (never return null).
   */
  abstract generate(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;

  /**
   * Optional readiness check — does this provider have its credentials
   * available? Used by the registry to surface misconfiguration early.
   */
  isConfigured(): boolean {
    return true;
  }
}

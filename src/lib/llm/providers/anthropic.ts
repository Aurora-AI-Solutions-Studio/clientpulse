// ─── Anthropic provider ───────────────────────────────────────────
// Ported from reforge/lib/llm/providers/anthropic.ts (Sprint 7.6 M1).

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from '../base-provider';
import { getModel } from '../models';
import {
  LLMError,
  type LLMCompletionRequest,
  type LLMCompletionResponse,
  type LLMProviderId,
} from '../types';

type StopReason = LLMCompletionResponse['stop_reason'];

function normalizeStopReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
      return 'end_turn';
    case 'max_tokens':
      return 'max_tokens';
    case 'stop_sequence':
      return 'stop_sequence';
    case 'tool_use':
      return 'tool_use';
    default:
      return 'unknown';
  }
}

export class AnthropicProvider extends BaseLLMProvider {
  readonly id: LLMProviderId = 'anthropic';

  private client: Anthropic | null = null;

  constructor(private readonly apiKey: string = process.env.ANTHROPIC_API_KEY ?? '') {
    super();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generate(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = getModel(req.model);
    if (model.provider !== 'anthropic') {
      throw new LLMError(
        `AnthropicProvider cannot serve ${req.model} (provider=${model.provider})`,
        this.id,
        req.model,
      );
    }

    // Anthropic separates `system` from `messages`. Accept either a
    // top-level `system` field or inline system-role messages and merge.
    const inlineSystem = req.messages.filter((m) => m.role === 'system').map((m) => m.content);
    const system = [req.system, ...inlineSystem].filter(Boolean).join('\n\n') || undefined;
    const convo = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const response = await this.getClient().messages.create({
        model: model.vendorId,
        max_tokens: req.max_tokens,
        temperature: req.temperature,
        system,
        messages: convo,
      });

      const firstText = response.content.find((b) => b.type === 'text');
      const text = firstText && firstText.type === 'text' ? firstText.text : '';

      return {
        text,
        model: req.model,
        provider: this.id,
        usage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
        stop_reason: normalizeStopReason(response.stop_reason ?? null),
      };
    } catch (err) {
      throw new LLMError(
        `Anthropic generate failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        req.model,
        err,
      );
    }
  }
}

// ─── OpenAI provider ──────────────────────────────────────────────
// Written against the /v1/chat/completions endpoint using fetch. We
// deliberately avoid the `openai` SDK dependency here — the surface
// area we need is tiny and we'd rather keep this layer dependency-light.
// (CP does have the `openai` package for Whisper transcription, but
//  chat completions are routed via fetch for parity with the ContentPulse port.)
//
// Ported from contentpulse/lib/llm/providers/openai.ts (Sprint 7.6 M1).

import { BaseLLMProvider } from '../base-provider';
import { getModel } from '../models';
import {
  LLMError,
  type LLMCompletionRequest,
  type LLMCompletionResponse,
  type LLMProviderId,
} from '../types';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatCompletionResponse = {
  choices: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function normalizeFinishReason(reason: string | null | undefined): LLMCompletionResponse['stop_reason'] {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'content_filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    default:
      return 'unknown';
  }
}

export class OpenAIProvider extends BaseLLMProvider {
  readonly id: LLMProviderId = 'openai';

  constructor(
    private readonly apiKey: string = process.env.OPENAI_API_KEY ?? '',
    private readonly baseUrl: string = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  ) {
    super();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generate(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = getModel(req.model);
    if (model.provider !== 'openai') {
      throw new LLMError(
        `OpenAIProvider cannot serve ${req.model} (provider=${model.provider})`,
        this.id,
        req.model,
      );
    }
    if (!this.apiKey) {
      throw new LLMError('OPENAI_API_KEY is not set', this.id, req.model);
    }

    const msgs: ChatMessage[] = [];
    if (req.system) msgs.push({ role: 'system', content: req.system });
    for (const m of req.messages) {
      msgs.push({ role: m.role, content: m.content });
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: model.vendorId,
          messages: msgs,
          max_tokens: req.max_tokens,
          temperature: req.temperature,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? '';

      return {
        text,
        model: req.model,
        provider: this.id,
        usage: {
          input_tokens: data.usage?.prompt_tokens ?? 0,
          output_tokens: data.usage?.completion_tokens ?? 0,
        },
        stop_reason: normalizeFinishReason(choice?.finish_reason ?? null),
      };
    } catch (err) {
      throw new LLMError(
        `OpenAI generate failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        req.model,
        err,
      );
    }
  }
}

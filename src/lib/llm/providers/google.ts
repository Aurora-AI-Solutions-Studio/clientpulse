// ─── Google (Gemini) provider ─────────────────────────────────────
// Uses the REST endpoint directly for the same reason we skip the OpenAI
// SDK — keep build size down until we need streaming or vision.
//
// Ported from contentpulse/lib/llm/providers/google.ts (Sprint 7.6 M1).

import { BaseLLMProvider } from '../base-provider';
import { getModel } from '../models';
import {
  LLMError,
  type LLMCompletionRequest,
  type LLMCompletionResponse,
  type LLMProviderId,
} from '../types';

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

function normalizeFinishReason(reason: string | null | undefined): LLMCompletionResponse['stop_reason'] {
  switch (reason) {
    case 'STOP':
      return 'end_turn';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'unknown';
  }
}

export class GoogleProvider extends BaseLLMProvider {
  readonly id: LLMProviderId = 'google';

  constructor(
    private readonly apiKey: string = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? '',
    private readonly baseUrl: string = process.env.GOOGLE_GENAI_BASE_URL
      ?? 'https://generativelanguage.googleapis.com/v1beta',
  ) {
    super();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generate(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = getModel(req.model);
    if (model.provider !== 'google') {
      throw new LLMError(
        `GoogleProvider cannot serve ${req.model} (provider=${model.provider})`,
        this.id,
        req.model,
      );
    }
    if (!this.apiKey) {
      throw new LLMError('GOOGLE_API_KEY / GEMINI_API_KEY is not set', this.id, req.model);
    }

    // Gemini has no "system" role. Hoist system prompt into systemInstruction.
    const inlineSystem = req.messages.filter((m) => m.role === 'system').map((m) => m.content);
    const systemText = [req.system, ...inlineSystem].filter(Boolean).join('\n\n');

    const contents: GeminiContent[] = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    try {
      const url = `${this.baseUrl}/models/${encodeURIComponent(model.vendorId)}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
          generationConfig: {
            maxOutputTokens: req.max_tokens,
            temperature: req.temperature,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      }

      const data = (await res.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

      return {
        text,
        model: req.model,
        provider: this.id,
        usage: {
          input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
          output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
        stop_reason: normalizeFinishReason(candidate?.finishReason ?? null),
      };
    } catch (err) {
      throw new LLMError(
        `Google generate failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        req.model,
        err,
      );
    }
  }
}

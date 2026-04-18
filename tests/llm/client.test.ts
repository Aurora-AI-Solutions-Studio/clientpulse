import { describe, expect, it } from 'vitest';
import { BaseLLMProvider } from '@/lib/llm/base-provider';
import { LLMProviderRegistry } from '@/lib/llm/registry';
import { generateCompletion } from '@/lib/llm/client';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProviderId,
} from '@/lib/llm/types';

class RecordingProvider extends BaseLLMProvider {
  public readonly calls: LLMCompletionRequest[] = [];
  constructor(public readonly id: LLMProviderId) { super(); }
  async generate(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    this.calls.push(req);
    return {
      text: `ok from ${this.id}:${req.model}`,
      model: req.model,
      provider: this.id,
      usage: { input_tokens: 42, output_tokens: 7 },
      stop_reason: 'end_turn',
    };
  }
}

function mkRegistry() {
  const r = new LLMProviderRegistry();
  const anth = new RecordingProvider('anthropic');
  const oai = new RecordingProvider('openai');
  const goog = new RecordingProvider('google');
  r.register(anth);
  r.register(oai);
  r.register(goog);
  return { registry: r, anth, oai, goog };
}

describe('generateCompletion — end-to-end routing', () => {
  it('Starter (Solo) tier request for Claude is rewritten to gpt-4o-mini on OpenAI', async () => {
    const { registry, oai, anth } = mkRegistry();
    const result = await generateCompletion({
      plan: 'starter',
      request: {
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 128,
      },
      registry,
    });

    expect(result.routed).toBe(true);
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('openai');
    expect(oai.calls).toHaveLength(1);
    expect(oai.calls[0].model).toBe('gpt-4o-mini');
    expect(anth.calls).toHaveLength(0);
  });

  it('Pro tier request for Claude goes straight to Anthropic', async () => {
    const { registry, anth, oai } = mkRegistry();
    const result = await generateCompletion({
      plan: 'pro',
      request: {
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 128,
      },
      registry,
    });

    expect(result.routed).toBe(false);
    expect(result.provider).toBe('anthropic');
    expect(anth.calls).toHaveLength(1);
    expect(oai.calls).toHaveLength(0);
  });

  it('Agency auto-routing with a scoring capability lands on the cheapest eligible model', async () => {
    const { registry, goog } = mkRegistry();
    const result = await generateCompletion({
      plan: 'agency',
      request: {
        messages: [{ role: 'user', content: 'rate this' }],
        max_tokens: 64,
      },
      routing: { capability: 'scoring' },
      registry,
    });

    expect(result.routed).toBe(true);
    expect(result.model).toBe('gemini-flash-lite-2-5');
    expect(result.provider).toBe('google');
    expect(goog.calls).toHaveLength(1);
  });

  it('surface-level response preserves usage and stop_reason from the provider', async () => {
    const { registry } = mkRegistry();
    const result = await generateCompletion({
      plan: 'pro',
      request: {
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 32,
      },
      registry,
    });
    expect(result.usage).toEqual({ input_tokens: 42, output_tokens: 7 });
    expect(result.stop_reason).toBe('end_turn');
  });
});

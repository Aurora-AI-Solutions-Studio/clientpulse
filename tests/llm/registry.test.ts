import { describe, expect, it } from 'vitest';
import { BaseLLMProvider } from '@/lib/llm/base-provider';
import { LLMProviderRegistry } from '@/lib/llm/registry';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProviderId,
} from '@/lib/llm/types';

class StubProvider extends BaseLLMProvider {
  constructor(public readonly id: LLMProviderId) { super(); }
  async generate(_req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    return {
      text: 'stub',
      model: _req.model,
      provider: this.id,
      usage: { input_tokens: 0, output_tokens: 0 },
      stop_reason: 'end_turn',
    };
  }
}

describe('LLMProviderRegistry', () => {
  it('register + get round-trips by id', () => {
    const r = new LLMProviderRegistry();
    const anth = new StubProvider('anthropic');
    r.register(anth);
    expect(r.has('anthropic')).toBe(true);
    expect(r.get('anthropic')).toBe(anth);
  });

  it('get throws when a provider is missing', () => {
    const r = new LLMProviderRegistry();
    expect(() => r.get('openai')).toThrow(/No provider registered/);
  });

  it('getForModel resolves the provider from the model catalog', () => {
    const r = new LLMProviderRegistry();
    r.register(new StubProvider('anthropic'));
    r.register(new StubProvider('openai'));
    r.register(new StubProvider('google'));

    expect(r.getForModel('claude-sonnet-4-5').id).toBe('anthropic');
    expect(r.getForModel('gpt-4o-mini').id).toBe('openai');
    expect(r.getForModel('gemini-flash-lite-2-5').id).toBe('google');
  });

  it('listProviders returns all registered ids', () => {
    const r = new LLMProviderRegistry();
    r.register(new StubProvider('anthropic'));
    r.register(new StubProvider('google'));
    expect(r.listProviders().sort()).toEqual(['anthropic', 'google']);
  });
});

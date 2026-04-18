import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '@/lib/llm/providers/anthropic';
import { OpenAIProvider } from '@/lib/llm/providers/openai';
import { GoogleProvider } from '@/lib/llm/providers/google';
import { LLMError } from '@/lib/llm/types';

describe('provider configuration guards', () => {
  it('AnthropicProvider.isConfigured reflects the apiKey', () => {
    expect(new AnthropicProvider('').isConfigured()).toBe(false);
    expect(new AnthropicProvider('sk-ant-test').isConfigured()).toBe(true);
  });

  it('OpenAIProvider.isConfigured reflects the apiKey', () => {
    expect(new OpenAIProvider('').isConfigured()).toBe(false);
    expect(new OpenAIProvider('sk-test').isConfigured()).toBe(true);
  });

  it('GoogleProvider.isConfigured reflects the apiKey', () => {
    expect(new GoogleProvider('').isConfigured()).toBe(false);
    expect(new GoogleProvider('g-key').isConfigured()).toBe(true);
  });
});

describe('provider-model mismatch guards', () => {
  it('AnthropicProvider throws when asked to serve a non-anthropic model', async () => {
    const p = new AnthropicProvider('sk-ant-test');
    await expect(
      p.generate({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 1,
      }),
    ).rejects.toBeInstanceOf(LLMError);
  });

  it('OpenAIProvider throws when asked to serve a non-openai model', async () => {
    const p = new OpenAIProvider('sk-test');
    await expect(
      p.generate({
        model: 'claude-sonnet-4-5',
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 1,
      }),
    ).rejects.toBeInstanceOf(LLMError);
  });

  it('GoogleProvider throws when asked to serve a non-google model', async () => {
    const p = new GoogleProvider('g-key');
    await expect(
      p.generate({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 1,
      }),
    ).rejects.toBeInstanceOf(LLMError);
  });
});

describe('OpenAI provider — wire format', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('posts to /chat/completions with the vendor model id and returns the response', async () => {
    const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toMatch(/\/chat\/completions$/);
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are terse.' },
        { role: 'user', content: 'hi' },
      ]);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hey' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    const p = new OpenAIProvider('sk-test');
    const res = await p.generate({
      model: 'gpt-4o-mini',
      system: 'You are terse.',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 16,
      temperature: 0.2,
    });

    expect(res.text).toBe('hey');
    expect(res.provider).toBe('openai');
    expect(res.usage).toEqual({ input_tokens: 3, output_tokens: 1 });
    expect(res.stop_reason).toBe('end_turn');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('wraps non-2xx responses in LLMError', async () => {
    globalThis.fetch = (async () =>
      new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const p = new OpenAIProvider('sk-test');
    await expect(
      p.generate({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 1,
      }),
    ).rejects.toBeInstanceOf(LLMError);
  });
});

describe('Google provider — wire format', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('hoists system messages into systemInstruction and maps assistant → model', async () => {
    const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      expect(u).toMatch(/gemini-2\.5-flash-lite:generateContent/);
      const body = JSON.parse((init?.body as string) ?? '{}');
      expect(body.systemInstruction.parts[0].text).toBe('Be brief.');
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'ok' }] },
      ]);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'done' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    const p = new GoogleProvider('g-key');
    const res = await p.generate({
      model: 'gemini-flash-lite-2-5',
      system: 'Be brief.',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'ok' },
      ],
      max_tokens: 8,
    });

    expect(res.text).toBe('done');
    expect(res.stop_reason).toBe('end_turn');
    expect(res.usage).toEqual({ input_tokens: 5, output_tokens: 2 });
    expect(spy).toHaveBeenCalledOnce();
  });
});

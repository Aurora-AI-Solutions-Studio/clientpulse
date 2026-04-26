import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../src/lib/email/resend';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FROM = process.env.RESEND_FROM_EMAIL;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = ORIGINAL_FROM;
});

describe('sendEmail', () => {
  it('returns skipped when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({
      to: 'a@b.c',
      subject: 's',
      html: '<p>hi</p>',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.skipped) {
      expect(result.reason).toBe('no-api-key');
    }
  });

  it('returns ok with id on 200', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'ClientPulse <brief@helloaurora.ai>';
    let receivedBody: Record<string, unknown> = {};
    global.fetch = vi.fn(async (_url, init) => {
      receivedBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await sendEmail({
      to: 'a@b.c',
      subject: 's',
      html: '<p>hi</p>',
      text: 'hi',
      tags: { kind: 'monday-brief' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('msg_123');
    expect(receivedBody.from).toBe('ClientPulse <brief@helloaurora.ai>');
    expect(receivedBody.to).toBe('a@b.c');
    expect(receivedBody.subject).toBe('s');
    expect(receivedBody.html).toBe('<p>hi</p>');
    expect(receivedBody.text).toBe('hi');
    expect(receivedBody.tags).toEqual([{ name: 'kind', value: 'monday-brief' }]);
  });

  it('returns failed with status + error body on Resend !ok', async () => {
    process.env.RESEND_API_KEY = 're_test';
    global.fetch = vi.fn(async () => new Response('rate_limited', { status: 429 })) as unknown as typeof fetch;
    const result = await sendEmail({ to: 'a@b.c', subject: 's', html: 'h' });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.status).toBe(429);
      expect(result.error).toBe('rate_limited');
    }
  });

  it('returns failed when fetch throws', async () => {
    process.env.RESEND_API_KEY = 're_test';
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await sendEmail({ to: 'a@b.c', subject: 's', html: 'h' });
    expect(result.ok).toBe(false);
    if (!result.ok && !result.skipped) {
      expect(result.error).toBe('network down');
    }
  });

  it('respects from override', async () => {
    process.env.RESEND_API_KEY = 're_test';
    let receivedBody: Record<string, unknown> = {};
    global.fetch = vi.fn(async (_u, init) => {
      receivedBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ id: 'm' }), { status: 200 });
    }) as unknown as typeof fetch;
    await sendEmail({
      to: 'a@b.c',
      subject: 's',
      html: 'h',
      from: 'Custom <x@y.z>',
    });
    expect(receivedBody.from).toBe('Custom <x@y.z>');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { resolveAppUrl } from '../../src/lib/url';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
});

function fakeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe('resolveAppUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://clientpulse.helloaurora.ai';
    expect(resolveAppUrl()).toBe('https://clientpulse.helloaurora.ai');
  });

  it('strips trailing slashes from env value', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://clientpulse.helloaurora.ai///';
    expect(resolveAppUrl()).toBe('https://clientpulse.helloaurora.ai');
  });

  it('falls back to request host when env not set', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const req = fakeRequest({ host: 'preview-abc.vercel.app', 'x-forwarded-proto': 'https' });
    expect(resolveAppUrl(req)).toBe('https://preview-abc.vercel.app');
  });

  it('defaults proto to https when x-forwarded-proto absent', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const req = fakeRequest({ host: 'preview-abc.vercel.app' });
    expect(resolveAppUrl(req)).toBe('https://preview-abc.vercel.app');
  });

  it('falls back to localhost when nothing else available', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(resolveAppUrl()).toBe('http://localhost:3000');
  });
});

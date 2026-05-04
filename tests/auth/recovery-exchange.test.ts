import { describe, it, expect, vi } from 'vitest';
import {
  runRecoveryExchange,
  type RecoveryExchangeClient,
} from '@/lib/auth/recovery-exchange';

function fakeClient(
  result: { error: { message?: string } | null },
): { client: RecoveryExchangeClient; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn().mockResolvedValue(result);
  return {
    client: { auth: { exchangeCodeForSession: spy } },
    spy,
  };
}

describe('runRecoveryExchange', () => {
  it('returns no-code and skips the exchange when code is missing', async () => {
    const { client, spy } = fakeClient({ error: null });
    const result = await runRecoveryExchange(client, null);
    expect(result).toEqual({ status: 'no-code' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns no-code when code is empty string', async () => {
    const { client, spy } = fakeClient({ error: null });
    const result = await runRecoveryExchange(client, '');
    expect(result).toEqual({ status: 'no-code' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls exchangeCodeForSession with the supplied code on success', async () => {
    const { client, spy } = fakeClient({ error: null });
    const result = await runRecoveryExchange(client, 'recovery-code-uuid');
    expect(spy).toHaveBeenCalledWith('recovery-code-uuid');
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns invalid when supabase reports the link is bad', async () => {
    const { client, spy } = fakeClient({
      error: { message: 'Code is invalid or has expired' },
    });
    const result = await runRecoveryExchange(client, 'expired-code');
    expect(spy).toHaveBeenCalledWith('expired-code');
    expect(result).toEqual({ status: 'invalid' });
  });
});

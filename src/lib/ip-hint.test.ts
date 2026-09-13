// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';

// ip-hint keeps a module-level cache, so each test must re-import the module
// (via vi.resetModules + dynamic import) to start from an empty cache.

async function freshGetIpHint() {
  vi.resetModules();
  const mod = await import('./ip-hint');
  return mod.getIpHint;
}

describe('getIpHint', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetchResponse(body: unknown, ok = true, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  function mockFetchReject(error: unknown) {
    globalThis.fetch = vi.fn().mockRejectedValue(error);
  }

  it('anonymizes the last octet of the public IP', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({ ip: '203.0.113.42' });
    expect(await getIpHint()).toBe('203.0.113.xxx');
  });

  it('falls back to "unavailable" on a non-ok response', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({}, false, 500);
    expect(await getIpHint()).toBe('unavailable');
  });

  it('falls back to "unavailable" on invalid payload', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({ ip: 123 });
    expect(await getIpHint()).toBe('unavailable');
    mockFetchResponse({});
    expect(await getIpHint()).toBe('unavailable');
  });

  it('falls back to "unavailable" on network error', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchReject(new Error('net down'));
    expect(await getIpHint()).toBe('unavailable');
  });

  it('caches the result in memory (no second fetch)', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({ ip: '198.51.100.7' });
    const first = await getIpHint();
    const second = await getIpHint();
    expect(first).toBe('198.51.100.xxx');
    expect(second).toBe(first);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('fails safely (unavailable) without throwing', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchReject(new TypeError('fetch failed'));
    await expect(getIpHint()).resolves.toBe('unavailable');
  });
});
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

  it('returns a valid IP string unchanged when it has no IPv4 last octet', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({ ip: 'not-an-ip' });
    await expect(getIpHint()).resolves.toBe('not-an-ip');
  });

  it('falls back to "unavailable" on a non-ok response', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchResponse({}, false, 500);
    expect(await getIpHint()).toBe('unavailable');
  });

  it('falls back to "unavailable" on invalid payload', async () => {
    let getIpHint = await freshGetIpHint();
    mockFetchResponse({ ip: 123 });
    expect(await getIpHint()).toBe('unavailable');

    getIpHint = await freshGetIpHint();
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

  it('shares an in-flight request between concurrent callers', async () => {
    const getIpHint = await freshGetIpHint();
    let resolveResponse!: (response: unknown) => void;
    globalThis.fetch = vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    })) as unknown as typeof fetch;

    const first = getIpHint();
    const second = getIpHint();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    resolveResponse({ ok: true, json: async () => ({ ip: '192.0.2.18' }) });
    await expect(Promise.all([first, second])).resolves.toEqual([
      '192.0.2.xxx',
      '192.0.2.xxx',
    ]);
  });

  it('fails safely (unavailable) without throwing', async () => {
    const getIpHint = await freshGetIpHint();
    mockFetchReject(new TypeError('fetch failed'));
    await expect(getIpHint()).resolves.toBe('unavailable');
  });

  it('aborts an IP request that exceeds the timeout', async () => {
    const getIpHint = await freshGetIpHint();
    globalThis.fetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;

    vi.useFakeTimers();
    try {
      const result = getIpHint();
      await vi.advanceTimersByTimeAsync(5000);
      await expect(result).resolves.toBe('unavailable');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
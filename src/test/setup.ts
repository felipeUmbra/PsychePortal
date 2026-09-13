// Shared test setup for Vitest.
// jsdom tests get @testing-library/jest-dom matchers (toBeVisible, etc.)
// plus per-test storage cleanup to guarantee isolation.

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Some lib modules (firestore-mock) touch localStorage even in node env.
// Provide a tiny in-memory shim so node-env tests don't crash.
function makeMemoryStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear() { store = new Map(); },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    key(index: number) { return Array.from(store.keys())[index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); },
  } as Storage;
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeMemoryStorage(),
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: makeMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

// Reset any module-level fetch/crypto mocks between tests.
afterEach(() => {
  vi.restoreAllMocks();
});

// Keep localStorage/sessionStorage isolated per test file run.
afterEach(() => {
  try {
    (globalThis as any).localStorage?.clear();
    (globalThis as any).sessionStorage?.clear();
  } catch {
    // ignore
  }
});
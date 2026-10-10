// Shared test setup for Vitest.
// jsdom tests get @testing-library/jest-dom matchers (toBeVisible, etc.)
// plus per-test storage cleanup to guarantee isolation.

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { indexedDB as fdb, IDBKeyRange, IDBIndex, IDBCursor, IDBTransaction, IDBObjectStore, IDBDatabase, IDBRequest, IDBOpenDBRequest } from 'fake-indexeddb';

// Mock global fetch for tests that need it (e.g., backup.ts)
vi.stubGlobal('fetch', vi.fn());

// Mock IndexedDB for tests that need it (e.g., offline-storage)
// fake-indexeddb exports indexedDB as an IDBFactory-like object with .open()
vi.stubGlobal('indexedDB', fdb);
vi.stubGlobal('IDBKeyRange', IDBKeyRange);
vi.stubGlobal('IDBIndex', IDBIndex);
vi.stubGlobal('IDBCursor', IDBCursor);
vi.stubGlobal('IDBTransaction', IDBTransaction);
vi.stubGlobal('IDBObjectStore', IDBObjectStore);
vi.stubGlobal('IDBDatabase', IDBDatabase);
vi.stubGlobal('IDBRequest', IDBRequest);
vi.stubGlobal('IDBOpenDBRequest', IDBOpenDBRequest);

// Use the REAL WebCrypto (Node >= 19 ships globalThis.crypto with subtle).
// The previous fake crypto.subtle mocks broke sha256 known-vector tests and
// made AES-GCM decrypt never reject on wrong keys / tampered payloads.
// Only fall back to a mock when real WebCrypto is unavailable.
const hasRealWebCrypto =
  typeof globalThis.crypto === 'object' &&
  globalThis.crypto !== null &&
  typeof (globalThis.crypto as any).subtle === 'object' &&
  (globalThis.crypto as any).subtle !== null;

if (!hasRealWebCrypto) {
  const mockCryptoSubtle = {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue({}),
    deriveKey: vi.fn().mockResolvedValue({}),
    generateKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    unwrapKey: vi.fn().mockResolvedValue({}),
  };
  vi.stubGlobal('crypto', {
    subtle: mockCryptoSubtle,
    getRandomValues: vi.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  });
}

// Mock window for tests that need it — but ONLY in node env.
// In jsdom env, `window` already exists with a real `document`,
// `addEventListener`, etc. Replacing it breaks @testing-library/react
// (renderHook needs window.document). In node env there is no window,
// so provide a minimal shim.
const isJsdom = typeof (globalThis as any).document === 'object' && (globalThis as any).document !== null;

if (!isJsdom) {
  const mockWindow = {
    location: { origin: 'http://localhost:5173' },
    navigator: { userAgent: 'test-agent' },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    crypto: hasRealWebCrypto ? globalThis.crypto : (globalThis as any).crypto,
  };
  vi.stubGlobal('window', mockWindow);
  vi.stubGlobal('navigator', { userAgent: 'test-agent' });
}

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
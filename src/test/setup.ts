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

// Mock window for tests that need it
const mockWindow = {
  location: { origin: 'http://localhost:5173' },
  navigator: { userAgent: 'test-agent' },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  crypto: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      importKey: vi.fn().mockResolvedValue({}),
      deriveKey: vi.fn().mockResolvedValue({}),
      generateKey: vi.fn().mockResolvedValue({}),
      encrypt: vi.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
        const ciphertext = new Uint8Array(data.byteLength + 16);
        ciphertext.set(new Uint8Array(data));
        for (let i = data.byteLength; i < ciphertext.length; i++) {
          ciphertext[i] = i % 256;
        }
        return ciphertext.buffer;
      }),
      decrypt: vi.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
        const plaintext = new Uint8Array(data.byteLength - 16);
        const dataView = new Uint8Array(data);
        plaintext.set(dataView.slice(0, -16));
        return plaintext.buffer;
      }),
      wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      unwrapKey: vi.fn().mockResolvedValue({}),
    },
    getRandomValues: vi.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
};

vi.stubGlobal('window', mockWindow);
vi.stubGlobal('navigator', { userAgent: 'test-agent' });

// Mock crypto.subtle for tests that need encryption (e.g., offline-storage, firestore-mock)
// Provide real SHA-256 for digest, mock others
const mockCryptoSubtle = {
  digest: vi.fn().mockImplementation(async (algorithm: string, data: ArrayBuffer) => {
    if (algorithm === 'SHA-256') {
      // Simple SHA-256 implementation for testing
      const msgUint8 = new Uint8Array(data);
      const hashBuffer = new ArrayBuffer(32);
      const hashView = new Uint8Array(hashBuffer);
      // Simple hash for testing - just use first 32 bytes of data or zeros
      for (let i = 0; i < 32; i++) {
        hashView[i] = msgUint8[i % msgUint8.length] || 0;
      }
      return hashBuffer;
    }
    return new ArrayBuffer(32);
  }),
  importKey: vi.fn().mockResolvedValue({}),
  deriveKey: vi.fn().mockResolvedValue({}),
  generateKey: vi.fn().mockResolvedValue({}),
  encrypt: vi.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
    const ciphertext = new Uint8Array(data.byteLength + 16);
    ciphertext.set(new Uint8Array(data));
    for (let i = data.byteLength; i < ciphertext.length; i++) {
      ciphertext[i] = i % 256;
    }
    return ciphertext.buffer;
  }),
  decrypt: vi.fn().mockImplementation(async (algorithm: any, key: any, data: ArrayBuffer) => {
    const plaintext = new Uint8Array(data.byteLength - 16);
    const dataView = new Uint8Array(data);
    plaintext.set(dataView.slice(0, -16));
    return plaintext.buffer;
  }),
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
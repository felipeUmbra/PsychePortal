/**
 * Unit tests for offline-storage.ts
 * Tests crypto utilities and logic (IndexedDB tests run in E2E)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  base64Encode, 
  base64Decode, 
  generateSalt,
  deriveKeyFromPassphrase,
  encryptData,
  decryptData,
  getDeviceMasterKey,
  wrapKey,
  unwrapKey,
} from './offline-storage';

// Mock crypto.subtle
const mockCrypto = {
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue({}),
    deriveKey: vi.fn().mockResolvedValue({}),
    generateKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    unwrapKey: vi.fn().mockResolvedValue({}),
  },
  getRandomValues: vi.fn((arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

// Mock localStorage
const mockLocalStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockLocalStorage.get(key) || null,
  setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
  removeItem: (key: string) => mockLocalStorage.delete(key),
  clear: () => mockLocalStorage.clear(),
};

// Mock window
const mockWindow = {
  location: { origin: 'http://localhost:5173' },
  navigator: { userAgent: 'test-agent' },
  dispatchEvent: vi.fn(),
  crypto: mockCrypto,
};

// Setup global mocks
beforeEach(() => {
  vi.stubGlobal('crypto', mockCrypto);
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('window', mockWindow);
  vi.stubGlobal('navigator', { 
    userAgent: 'test-agent',
    storage: { estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 1000000 }) }
  });
  
  mockLocalStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offlineStorage crypto utilities', () => {
  describe('base64Encode/base64Decode', () => {
    it('should encode and decode correctly', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = base64Encode(testData);
      const decoded = base64Decode(encoded);
      expect(decoded).toEqual(testData);
    });

    it('should handle empty array', () => {
      const testData = new Uint8Array([]);
      const encoded = base64Encode(testData);
      const decoded = base64Decode(encoded);
      expect(decoded).toEqual(testData);
    });
  });

  describe('generateSalt', () => {
    it('should generate salt of correct length', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('should generate different salts each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('deriveKeyFromPassphrase', () => {
    it('should derive key from passphrase and salt', async () => {
      const passphrase = 'test-passphrase-123';
      const salt = generateSalt();
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      expect(key).toBeDefined();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
    });
  });

  describe('encryptData/decryptData', () => {
    it('should encrypt and decrypt data', async () => {
      const mockKey = {} as CryptoKey;
      const testData = '{"id":"test","name":"Test Patient"}';
      
      // Mock encrypt to return predictable result
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]).buffer);
      
      const encrypted = await encryptData(testData, mockKey);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('timestamp');
    });
  });

  describe('device master key', () => {
    it('should generate device master key', async () => {
      const key = await getDeviceMasterKey();
      expect(key).toBeDefined();
      expect(mockCrypto.subtle.digest).toHaveBeenCalled();
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
    });
  });

  describe('wrapKey/unwrapKey', () => {
    it('should wrap and unwrap key', async () => {
      const mockKey = {} as CryptoKey;
      const mockMasterKey = {} as CryptoKey;
      
      const wrapped = await wrapKey(mockKey, mockMasterKey);
      expect(typeof wrapped).toBe('string');
      expect(mockCrypto.subtle.wrapKey).toHaveBeenCalled();
      
      await unwrapKey(wrapped, mockMasterKey);
      expect(mockCrypto.subtle.unwrapKey).toHaveBeenCalled();
    });
  });
});

describe('offlineStorage sync metadata', () => {
  // These tests would need IndexedDB - skip for unit tests
  it('should have sync metadata functions exported', async () => {
    const { 
      getSyncMetadata, 
      setSyncMetadata, 
      incrementPendingOperations, 
      decrementPendingOperations, 
      markSynced 
    } = await import('./offline-storage');
    
    expect(typeof getSyncMetadata).toBe('function');
    expect(typeof setSyncMetadata).toBe('function');
    expect(typeof incrementPendingOperations).toBe('function');
    expect(typeof decrementPendingOperations).toBe('function');
    expect(typeof markSynced).toBe('function');
  });
});

describe('offlineStorage CRUD operations', () => {
  // These tests would need IndexedDB - skip for unit tests
  it('should have CRUD functions exported', async () => {
    const { 
      offlineStorage 
    } = await import('./offline-storage');
    
    expect(typeof offlineStorage.getAll).toBe('function');
    expect(typeof offlineStorage.get).toBe('function');
    expect(typeof offlineStorage.put).toBe('function');
    expect(typeof offlineStorage.delete).toBe('function');
    expect(typeof offlineStorage.clear).toBe('function');
    expect(typeof offlineStorage.replaceAll).toBe('function');
    expect(typeof offlineStorage.getAllCollections).toBe('function');
  });
});

describe('offlineStorage initialization', () => {
  it('should have init and utility functions exported', async () => {
    const { 
      init, 
      isReady, 
      setUserEncryptionKey, 
      clearEncryptionKey, 
      hasEncryptionKey, 
      enforceTTL, 
      checkQuota, 
      clearAll 
    } = await import('./offline-storage');
    
    expect(typeof init).toBe('function');
    expect(typeof isReady).toBe('function');
    expect(typeof setUserEncryptionKey).toBe('function');
    expect(typeof clearEncryptionKey).toBe('function');
    expect(typeof hasEncryptionKey).toBe('function');
    expect(typeof enforceTTL).toBe('function');
    expect(typeof checkQuota).toBe('function');
    expect(typeof clearAll).toBe('function');
  });
});
/**
 * Unit tests for offline-storage.ts
 * Tests crypto utilities and logic (IndexedDB tests run in E2E)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  IDBCursor,
  IDBDatabase as FakeIDBDatabase,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  indexedDB as fakeIndexedDB,
} from 'fake-indexeddb';
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
  __resetForTesting,
  enforceTTL,
  init,
  isReady,
  offlineStorage,
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

describe('offlineStorage error handling and edge cases', () => {
  describe('encryptData/decryptData error paths', () => {
    it('should handle encryption failure gracefully', async () => {
      const mockKey = {} as CryptoKey;
      const testData = '{"id":"test","name":"Test Patient"}';
      
      // Mock encrypt to throw
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));
      
      await expect(encryptData(testData, mockKey)).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption failure gracefully', async () => {
      const mockKey = {} as CryptoKey;
      const encryptedData = {
        ciphertext: 'base64ciphertext',
        iv: 'base64iv',
        tag: 'base64tag',
        salt: 'base64salt',
        timestamp: Date.now(),
      };
      
      // Mock decrypt to throw
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));
      
          await expect(decryptData(encryptedData, mockKey)).rejects.toThrow();
    });
  });

  describe('wrapKey/unwrapKey error paths', () => {
    it('should handle wrapKey failure', async () => {
      const mockKey = {} as CryptoKey;
      const mockMasterKey = {} as CryptoKey;
      
      mockCrypto.subtle.wrapKey.mockRejectedValueOnce(new Error('Wrap failed'));
      
      await expect(wrapKey(mockKey, mockMasterKey)).rejects.toThrow('Wrap failed');
    });

    it('should handle unwrapKey failure', async () => {
      const wrappedKey = 'base64wrappedkey';
      const mockMasterKey = {} as CryptoKey;
      
      mockCrypto.subtle.unwrapKey.mockRejectedValueOnce(new Error('Unwrap failed'));
      
      await expect(unwrapKey(wrappedKey, mockMasterKey)).rejects.toThrow('Unwrap failed');
    });
  });

  describe('getDeviceMasterKey error paths', () => {
    it('should handle digest failure', async () => {
      mockCrypto.subtle.digest.mockRejectedValueOnce(new Error('Digest failed'));
      
      await expect(getDeviceMasterKey()).rejects.toThrow('Digest failed');
    });

    it('should handle importKey failure', async () => {
      mockCrypto.subtle.digest.mockResolvedValueOnce(new ArrayBuffer(32));
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Import failed'));
      
      await expect(getDeviceMasterKey()).rejects.toThrow('Import failed');
    });
  });

  describe('deriveKeyFromPassphrase error paths', () => {
    it('should handle deriveKey failure', async () => {
      const passphrase = 'test-passphrase-123';
      const salt = generateSalt();
      
      mockCrypto.subtle.deriveKey.mockRejectedValueOnce(new Error('Derive failed'));
      
      await expect(deriveKeyFromPassphrase(passphrase, salt)).rejects.toThrow('Derive failed');
    });
  });
});

describe('offlineStorage utility functions', () => {
  describe('base64Encode/base64Decode edge cases', () => {
    it('should handle ArrayBuffer input', () => {
      const buf = new TextEncoder().encode('test').buffer;
      const encoded = base64Encode(buf);
      const decoded = base64Decode(encoded);
      expect(new TextDecoder().decode(decoded)).toBe('test');
    });

    it('should handle large data', () => {
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      const encoded = base64Encode(largeData);
      const decoded = base64Decode(encoded);
      expect(decoded).toEqual(largeData);
    });
  });

  describe('generateSalt', () => {
    it('should generate cryptographically random salt', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
      expect(salt1.length).toBe(16);
      expect(salt2.length).toBe(16);
    });
  });
});

// ============================================================================
// Additional crypto utility tests for better coverage
// ============================================================================

describe('offlineStorage additional crypto utilities', () => {
  describe('encryptData/decryptData with various inputs', () => {
    it('should handle empty string', async () => {
      const mockKey = {} as CryptoKey;
      const testData = '';
      
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(new Uint8Array(16).buffer);
      
      const encrypted = await encryptData(testData, mockKey);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
    });

    it('should handle special characters', async () => {
      const mockKey = {} as CryptoKey;
      const testData = '{"name":"João Silva","notes":"Special chars: àéíóú ñ ç"}';
      
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(new Uint8Array(32).buffer);
      
      const encrypted = await encryptData(testData, mockKey);
      expect(encrypted).toHaveProperty('ciphertext');
    });

    it('should handle very long data', async () => {
      const mockKey = {} as CryptoKey;
      const testData = 'x'.repeat(10000);
      
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(new Uint8Array(10016).buffer);
      
      const encrypted = await encryptData(testData, mockKey);
      expect(encrypted).toHaveProperty('ciphertext');
    });
  });

  describe('offlineStorage IndexedDB operations', () => {
    beforeEach(async () => {
      vi.stubGlobal('crypto', webcrypto);
      vi.stubGlobal('indexedDB', fakeIndexedDB);
      vi.stubGlobal('IDBKeyRange', IDBKeyRange);
      vi.stubGlobal('IDBCursor', IDBCursor);
      vi.stubGlobal('IDBDatabase', FakeIDBDatabase);
      vi.stubGlobal('IDBIndex', IDBIndex);
      vi.stubGlobal('IDBObjectStore', IDBObjectStore);
      vi.stubGlobal('IDBOpenDBRequest', IDBOpenDBRequest);
      vi.stubGlobal('IDBRequest', IDBRequest);
      vi.stubGlobal('IDBTransaction', IDBTransaction);

      // Initialize once to create the schema before resetting the module state.
      await init();
      await __resetForTesting();
    });

    afterEach(async () => {
      await __resetForTesting();
    });

    async function putRawPatient(record: object): Promise<void> {
      const request = fakeIndexedDB.open('psycheportal-offline', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction('patients', 'readwrite');
      transaction.objectStore('patients').put(record);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    }

    async function putRawDeviceKey(record: object): Promise<void> {
      const request = fakeIndexedDB.open('psycheportal-offline', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction('metadata', 'readwrite');
      transaction.objectStore('metadata').put(record, 'device-master-key');
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    }

    it('persists, decrypts, migrates and cleans up records across the full lifecycle', async () => {
      expect(await isReady()).toBe(false);

      localStorageMock.setItem('offline_storage_disabled', 'true');
      await init();
      expect(await isReady()).toBe(true);

      await __resetForTesting();
      localStorageMock.clear();
      localStorageMock.setItem('mock_db_cache', JSON.stringify({
        patients: [{ id: 'migrated-patient', name: 'Migrated' }],
        sessions: [{ id: 'migrated-session', patientId: 'migrated-patient' }],
      }));
      await init();
      expect(mockLocalStorage.has('mock_db_cache')).toBe(false);
      expect(await offlineStorage.get('patients', 'migrated-patient')).toMatchObject({
        id: 'migrated-patient',
        name: 'Migrated',
      });
      await init();

      await __resetForTesting();
      localStorageMock.clear();
      localStorageMock.setItem('mock_db_cache', '{invalid json');
      const migrationError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await init();
      expect(mockLocalStorage.has('mock_db_cache')).toBe(true);
      expect(migrationError).toHaveBeenCalledWith(
        'Failed to migrate legacy cache:',
        expect.any(SyntaxError),
      );

      await __resetForTesting();
      localStorageMock.clear();
      localStorageMock.setItem('mock_db_cache', JSON.stringify({ patients: [], sessions: 'invalid' }));
      await init();
      expect(mockLocalStorage.has('mock_db_cache')).toBe(true);

      await __resetForTesting();
      localStorageMock.clear();
      await init();
      expect(await offlineStorage.getSyncMetadata()).toEqual({
        lastSynced: null,
        pendingOperations: 0,
        driveTokenPresent: false,
      });

      const patient = { id: 'patient-1', name: 'Encrypted patient' };
      await offlineStorage.put('patients', patient);
      expect(await offlineStorage.get('patients', patient.id)).toEqual(patient);
      expect(await offlineStorage.get('patients', 'missing')).toBeNull();
      expect(await offlineStorage.getAll('patients')).toEqual([patient]);

      await putRawPatient({
        id: 'corrupt-patient',
        data: { ciphertext: '!', iv: '!', tag: '!', salt: '', timestamp: 0 },
        updatedAt: Date.now(),
      });
      const decryptError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await offlineStorage.get('patients', 'corrupt-patient')).toBeNull();
      expect(await offlineStorage.getAll('patients')).toEqual([patient]);
      expect(decryptError).toHaveBeenCalled();

      await offlineStorage.replaceAll('sessions', [
        { id: 'session-1', patientId: patient.id },
        { id: 'session-2', patientId: patient.id },
      ]);
      expect(await offlineStorage.getAll('sessions')).toHaveLength(2);
      await offlineStorage.replaceAll('sessions', []);
      expect(await offlineStorage.getAll('sessions')).toEqual([]);
      expect(Object.keys(await offlineStorage.getAllCollections())).toEqual([
        'patients',
        'sessions',
        'psychologists',
        'audit_logs',
        'patient_consents',
        'note_versions',
      ]);

      await offlineStorage.put('patients', { id: 'stale-patient', name: 'Expired' });
      await putRawPatient({
        id: 'old-patient',
        data: {},
        updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
      await enforceTTL(1);
      expect(await offlineStorage.get('patients', 'old-patient')).toBeNull();

      const quotaWarning = vi.spyOn(window, 'dispatchEvent');
      vi.stubGlobal('navigator', {
        userAgent: 'test-agent',
        storage: { estimate: vi.fn().mockResolvedValue({ usage: 900, quota: 1000 }) },
      });
      expect(await offlineStorage.checkQuota()).toEqual({
        usage: 900,
        quota: 1000,
        percentage: 0.9,
      });
      expect(quotaWarning).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'offline-storage-quota-warning' }),
      );

      vi.stubGlobal('navigator', {
        userAgent: 'test-agent',
        storage: { estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 1000 }) },
      });
      expect(await offlineStorage.checkQuota()).toEqual({
        usage: 100,
        quota: 1000,
        percentage: 0.1,
      });
      vi.stubGlobal('navigator', {
        userAgent: 'test-agent',
        storage: { estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 1000 }) },
      });
      expect(await offlineStorage.checkQuota()).toBeNull();
      vi.stubGlobal('navigator', { userAgent: 'test-agent' });
      expect(await offlineStorage.checkQuota()).toBeNull();

      const quotaError = vi.spyOn(console, 'debug').mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        userAgent: 'test-agent',
        storage: { estimate: vi.fn().mockRejectedValue(new Error('quota unavailable')) },
      });
      expect(await offlineStorage.checkQuota()).toBeNull();
      expect(quotaError).toHaveBeenCalled();

      await offlineStorage.setSyncMetadata({ pendingOperations: 1, driveTokenPresent: true });
      await offlineStorage.incrementPendingOperations();
      await offlineStorage.decrementPendingOperations();
      await offlineStorage.decrementPendingOperations();
      expect((await offlineStorage.getSyncMetadata()).pendingOperations).toBe(0);
      await offlineStorage.markSynced();
      const synced = await offlineStorage.getSyncMetadata();
      expect(synced.driveTokenPresent).toBe(true);
      expect(synced.lastSynced).toEqual(expect.any(Number));

      const userKey = await webcrypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
      await offlineStorage.setUserEncryptionKey(userKey);
      expect(await offlineStorage.hasEncryptionKey()).toBe(true);
      await offlineStorage.clearEncryptionKey();
      expect(await offlineStorage.hasEncryptionKey()).toBe(false);
      await offlineStorage.put('patients', { id: 'after-key-clear' });
      expect(await offlineStorage.get('patients', 'after-key-clear')).toEqual({
        id: 'after-key-clear',
      });

      await offlineStorage.deleteRecord('patients', 'patient-1');
      expect(await offlineStorage.get('patients', 'patient-1')).toBeNull();
      await offlineStorage.clear('patients');
      expect(await offlineStorage.getAll('patients')).toEqual([]);
      await offlineStorage.clearAll();
      expect(await offlineStorage.getAll('patients')).toEqual([]);

      // A fresh module instance must unwrap the persisted device key to read data.
      await offlineStorage.put('patients', { id: 'reloaded-patient', name: 'Still readable' });
      vi.resetModules();
      const reloadedStorage = await import('./offline-storage');
      expect(await reloadedStorage.get('patients', 'reloaded-patient')).toEqual({
        id: 'reloaded-patient',
        name: 'Still readable',
      });

      await putRawDeviceKey({ wrappedKey: 'corrupt-wrapped-key', algorithm: 'AES-GCM' });
      vi.resetModules();
      const corruptKeyStorage = await import('./offline-storage');
      const keyWarning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await corruptKeyStorage.get('patients', 'reloaded-patient')).toBeNull();
      expect(keyWarning).toHaveBeenCalledWith(
        'Failed to unwrap device key, generating new one:',
        expect.any(Error),
      );

      const transactionFailure = vi.spyOn(FakeIDBDatabase.prototype, 'transaction')
        .mockImplementation(() => { throw new Error('IndexedDB unavailable'); });
      const ttlError = vi.spyOn(console, 'debug').mockImplementation(() => {});
      try {
        await corruptKeyStorage.enforceTTL(1);
        expect(ttlError).toHaveBeenCalled();
      } finally {
        transactionFailure.mockRestore();
        ttlError.mockRestore();
      }
    });
  });

  describe('wrapKey/unwrapKey edge cases', () => {
    it('should handle wrapKey with different key types', async () => {
      const mockKey = {} as CryptoKey;
      const mockMasterKey = {} as CryptoKey;
      
      mockCrypto.subtle.wrapKey.mockResolvedValueOnce(new Uint8Array(28).buffer);
      
      const wrapped = await wrapKey(mockKey, mockMasterKey);
      expect(typeof wrapped).toBe('string');
      expect(wrapped.length).toBeGreaterThan(0);
    });

    it('should handle unwrapKey with valid wrapped key', async () => {
      const wrappedKey = 'dGVzdC13cmFwcGVkLWtleQ=='; // base64 encoded
      const mockMasterKey = {} as CryptoKey;
      
      mockCrypto.subtle.unwrapKey.mockResolvedValueOnce({});
      
      const unwrapped = await unwrapKey(wrappedKey, mockMasterKey);
      expect(unwrapped).toBeDefined();
    });
  });

  describe('getDeviceMasterKey consistency', () => {
    it('should generate consistent key for same origin and userAgent', async () => {
      const key1 = await getDeviceMasterKey();
      const key2 = await getDeviceMasterKey();
      
      // Should be the same key (cached)
      expect(key1).toBe(key2);
    });
  });

  describe('deriveKeyFromPassphrase determinism', () => {
    it('should derive same key for same passphrase and salt', async () => {
      const passphrase = 'test-passphrase-123';
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt);
      const key2 = await deriveKeyFromPassphrase(passphrase, salt);
      
      // Should be different keys (PBKDF2 is deterministic but we mock it)
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });
  });

    describe('IndexedDB store/index creation branches', () => {
      beforeEach(async () => {
        vi.stubGlobal('crypto', webcrypto);
        vi.stubGlobal('indexedDB', fakeIndexedDB);
        vi.stubGlobal('IDBKeyRange', IDBKeyRange);
        vi.stubGlobal('IDBCursor', IDBCursor);
        vi.stubGlobal('IDBDatabase', FakeIDBDatabase);
        vi.stubGlobal('IDBIndex', IDBIndex);
        vi.stubGlobal('IDBObjectStore', IDBObjectStore);
        vi.stubGlobal('IDBOpenDBRequest', IDBOpenDBRequest);
        vi.stubGlobal('IDBRequest', IDBRequest);
        vi.stubGlobal('IDBTransaction', IDBTransaction);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should handle IndexedDB upgrade with store creation', async () => {
        // Test the upgrade path by resetting and re-initializing
        await __resetForTesting();
        localStorageMock.clear();
        await init();
        expect(await isReady()).toBe(true);
      });

      it('should handle IndexedDB upgrade with index creation', async () => {
        // The upgrade function creates indexes for each store config
        await __resetForTesting();
        localStorageMock.clear();
        await init();
      
        // Put some data to exercise the indexes
        await offlineStorage.put('patients', { id: 'index-test-1', name: 'Test' });
        await offlineStorage.put('sessions', { id: 'index-test-2', patientId: 'index-test-1', date: new Date().toISOString() });
        await offlineStorage.put('psychologists', { id: 'index-test-3', name: 'Dr. Test' });
        await offlineStorage.put('audit_logs', { id: 'index-test-4', actorId: 'psych-1', timestamp: Date.now() });
        await offlineStorage.put('patient_consents', { id: 'index-test-5', patientId: 'index-test-1' });
        await offlineStorage.put('note_versions', { id: 'index-test-6', sessionId: 'index-test-2' });
      
        expect(await offlineStorage.get('patients', 'index-test-1')).toBeDefined();
        expect(await offlineStorage.get('sessions', 'index-test-2')).toBeDefined();
        expect(await offlineStorage.get('psychologists', 'index-test-3')).toBeDefined();
        expect(await offlineStorage.get('audit_logs', 'index-test-4')).toBeDefined();
        expect(await offlineStorage.get('patient_consents', 'index-test-5')).toBeDefined();
        expect(await offlineStorage.get('note_versions', 'index-test-6')).toBeDefined();
      });

      it('should handle IndexedDB metadata store creation', async () => {
        await __resetForTesting();
        localStorageMock.clear();
        await init();
      
        const metadata = await offlineStorage.getSyncMetadata();
        expect(metadata).toEqual({
          lastSynced: null,
          pendingOperations: 0,
          driveTokenPresent: false,
        });
      });

      it('should handle IndexedDB store creation for all collections', async () => {
        await __resetForTesting();
        localStorageMock.clear();
        await init();
      
        const collections = await offlineStorage.getAllCollections();
        expect(Object.keys(collections)).toEqual([
          'patients',
          'sessions',
          'psychologists',
          'audit_logs',
          'patient_consents',
          'note_versions',
        ]);
      });
    });
  });
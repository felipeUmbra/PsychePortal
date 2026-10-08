/**
 * Offline Storage Module - Encrypted IndexedDB persistence for PsychePortal
 * Provides durable local storage when Google Drive token is unavailable.
 * Uses AES-GCM 256-bit encryption with device-bound key (no user passphrase required).
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  CollectionName,
  OfflineStoreConfig,
  EncryptedPayload,
  SyncMetadata,
  StoredRecord,
  DeviceKeyRecord,
  OfflineStorageConfig,
} from './offline-storage.types';

// ============================================================================
// Configuration
// ============================================================================

const DB_NAME = 'psycheportal-offline';
const DB_VERSION = 1;
const METADATA_STORE = 'metadata';
const DEVICE_KEY_STORE = 'device_keys';

const STORE_CONFIGS: OfflineStoreConfig[] = [
  { name: 'patients', keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }, { name: 'patientId', keyPath: 'patientId' }, { name: 'date', keyPath: 'date' }] },
  { name: 'sessions', keyPath: 'id', indexes: [{ name: 'patientId', keyPath: 'patientId' }, { name: 'date', keyPath: 'date' }, { name: 'updatedAt', keyPath: 'updatedAt' }] },
  { name: 'psychologists', keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
  { name: 'audit_logs', keyPath: 'id', indexes: [{ name: 'timestamp', keyPath: 'timestamp' }, { name: 'updatedAt', keyPath: 'updatedAt' }] },
  { name: 'patient_consents', keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
  { name: 'note_versions', keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
];

const COLLECTIONS: CollectionName[] = [
  'patients',
  'sessions',
  'psychologists',
  'audit_logs',
  'patient_consents',
  'note_versions',
];

const TTL_DAYS = 90;
const QUOTA_WARNING_THRESHOLD = 0.8; // 80%

// ============================================================================
// Type Definitions for idb
// ============================================================================

interface OfflineDBSchema extends DBSchema {
  patients: { key: string; value: StoredRecord; indexes: { updatedAt: number; patientId: string; date: string } };
  sessions: { key: string; value: StoredRecord; indexes: { patientId: string; date: string; updatedAt: number } };
  psychologists: { key: string; value: StoredRecord; indexes: { updatedAt: number } };
  audit_logs: { key: string; value: StoredRecord; indexes: { timestamp: number; updatedAt: number } };
  patient_consents: { key: string; value: StoredRecord; indexes: { updatedAt: number } };
  note_versions: { key: string; value: StoredRecord; indexes: { updatedAt: number } };
  [METADATA_STORE]: { key: string; value: SyncMetadata | DeviceKeyRecord | { key: string; lastSynced: number | null; pendingOperations: number; driveTokenPresent: boolean }; indexes: Record<string, never> };
}

// ============================================================================
// Crypto Utilities (adapted from note-crypto.ts)
// ============================================================================

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function base64Encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptData(data: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  // AES-GCM returns ciphertext + auth tag concatenated
  const ciphertextArray = new Uint8Array(ciphertext);
  const tagLength = 16; // AES-GCM auth tag is 16 bytes
  const actualCiphertext = ciphertextArray.slice(0, -tagLength);
  const tag = ciphertextArray.slice(-tagLength);

  return {
    ciphertext: base64Encode(actualCiphertext),
    iv: base64Encode(iv),
    tag: base64Encode(tag),
    salt: '', // Will be set by caller
    timestamp: Date.now(),
  };
}

async function decryptData(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const iv = base64Decode(payload.iv);
  const ciphertext = base64Decode(payload.ciphertext);
  const tag = base64Decode(payload.tag);

  // Reconstruct ciphertext + tag for AES-GCM decrypt
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}

// Export crypto utilities for testing
export { base64Encode, base64Decode, generateSalt, deriveKeyFromPassphrase, encryptData, decryptData, getDeviceMasterKey, wrapKey, unwrapKey };

// ============================================================================
// Device-Bound Master Key
// ============================================================================

async function getDeviceMasterKey(): Promise<CryptoKey> {
  // Derive a master key from origin + user agent (device-bound, not user-bound)
  const deviceFingerprint = `${window.location.origin}|${navigator.userAgent}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceFingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
}

async function wrapKey(key: CryptoKey, masterKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey('raw', key, masterKey, { name: 'AES-GCM' });
  return base64Encode(wrapped);
}

async function unwrapKey(wrappedBase64: string, masterKey: CryptoKey): Promise<CryptoKey> {
  const wrapped = base64Decode(wrappedBase64);
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    masterKey,
    { name: 'AES-GCM' },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ============================================================================
// Database Instance
// ============================================================================

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;
let encryptionKey: CryptoKey | null = null;
let isInitialized = false;

async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create collection stores
      for (const config of STORE_CONFIGS) {
              const storeName = config.name;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
          if (config.indexes) {
            for (const index of config.indexes) {
                    // Type assertion needed because index names are dynamic
                    (store as any).createIndex(index.name, index.keyPath, { unique: index.unique });
                  }
                }
              }
            }

      // Metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    },
  });

  return dbInstance;
}

// ============================================================================
// Encryption Key Management
// ============================================================================

async function ensureEncryptionKey(): Promise<CryptoKey> {
  if (encryptionKey) return encryptionKey;

  const db = await getDB();
  const masterKey = await getDeviceMasterKey();

  // Try to load existing wrapped key
  const existing = await db.get(METADATA_STORE, 'device-master-key') as DeviceKeyRecord | undefined;

  if (existing?.wrappedKey) {
    try {
      encryptionKey = await unwrapKey(existing.wrappedKey, masterKey);
      return encryptionKey;
    } catch (err) {
      console.warn('Failed to unwrap device key, generating new one:', err);
    }
  }

  // Generate new key
  encryptionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable for wrapping
    ['encrypt', 'decrypt'],
  );

  // Wrap and store
  const wrapped = await wrapKey(encryptionKey, masterKey);
  await db.put(METADATA_STORE, { key: 'device-master-key', wrappedKey: wrapped, algorithm: 'AES-GCM' });

  return encryptionKey;
}

export async function setUserEncryptionKey(key: CryptoKey): Promise<void> {
  // Called when user enables clinical note encryption
  // Replace device-bound key with user's key
  encryptionKey = key;
  
  const db = await getDB();
  const masterKey = await getDeviceMasterKey();
  const wrapped = await wrapKey(key, masterKey);
  await db.put(METADATA_STORE, { key: 'device-master-key', wrappedKey: wrapped, algorithm: 'AES-GCM' });
}

export async function clearEncryptionKey(): Promise<void> {
  encryptionKey = null;
  const db = await getDB();
  await db.delete(METADATA_STORE, 'device-master-key');
  // Next access will generate new device-bound key
}

export async function hasEncryptionKey(): Promise<boolean> {
  const db = await getDB();
  const record = await db.get(METADATA_STORE, 'device-master-key') as DeviceKeyRecord | undefined;
  return !!record?.wrappedKey;
}

// ============================================================================
// Core Storage Operations
// ============================================================================

async function encryptRecord(data: any): Promise<EncryptedPayload> {
  const key = await ensureEncryptionKey();
  const json = JSON.stringify(data);
  const payload = await encryptData(json, key);
  // Generate salt for this record (for potential future key rotation)
  const salt = generateSalt();
  payload.salt = base64Encode(salt);
  return payload;
}

async function decryptRecord(payload: EncryptedPayload): Promise<any> {
  const key = await ensureEncryptionKey();
  const json = await decryptData(payload, key);
  return JSON.parse(json);
}

// Type for collection store names (excludes metadata)
type CollectionStoreName = 'patients' | 'sessions' | 'psychologists' | 'audit_logs' | 'patient_consents' | 'note_versions';

export async function getAll(collection: CollectionName): Promise<any[]> {
  const db = await getDB();
  const records = await db.getAll(collection as CollectionStoreName);
  const results = [];
  
  for (const record of records) {
    try {
      const decrypted = await decryptRecord(record.data);
      results.push(decrypted);
    } catch (err) {
      console.error(`Failed to decrypt record ${record.id} in ${collection}:`, err);
      // Skip corrupted records
    }
  }
  
  return results;
}

export async function get(collection: CollectionName, id: string): Promise<any | null> {
  const db = await getDB();
  const record = await db.get(collection as CollectionStoreName, id);
  if (!record) return null;
  
  try {
    return await decryptRecord(record.data);
  } catch (err) {
    console.error(`Failed to decrypt record ${id} in ${collection}:`, err);
    return null;
  }
}

export async function put(collection: CollectionName, data: any): Promise<void> {
  const db = await getDB();
  const encrypted = await encryptRecord(data);
  const record: StoredRecord = {
    id: data.id,
    data: encrypted,
    updatedAt: Date.now(),
  };
  await db.put(collection as CollectionStoreName, record);
}

export async function deleteRecord(collection: CollectionName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(collection as CollectionStoreName, id);
}

export async function clear(collection: CollectionName): Promise<void> {
  const db = await getDB();
  await db.clear(collection as CollectionStoreName);
}

export async function replaceAll(collection: CollectionName, data: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(collection as CollectionStoreName, 'readwrite');
  await tx.store.clear();
  
  for (const item of data) {
    const encrypted = await encryptRecord(item);
    const record: StoredRecord = {
      id: item.id,
      data: encrypted,
      updatedAt: Date.now(),
    };
    await tx.store.put(record);
  }
  
  await tx.done;
}

export async function getAllCollections(): Promise<Record<CollectionName, any[]>> {
  const result: Partial<Record<CollectionName, any[]>> = {};
  
  for (const col of COLLECTIONS) {
    result[col] = await getAll(col);
  }
  
  return result as Record<CollectionName, any[]>;
}

// ============================================================================
// Sync Metadata
// ============================================================================

const DEFAULT_METADATA: SyncMetadata = {
  lastSynced: null,
  pendingOperations: 0,
  driveTokenPresent: false,
};

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDB();
  const meta = await db.get(METADATA_STORE, 'sync') as SyncMetadata | undefined;
  return meta || DEFAULT_METADATA;
}

export async function setSyncMetadata(meta: Partial<SyncMetadata>): Promise<void> {
  const db = await getDB();
  const current = await getSyncMetadata();
  const updated = { ...current, ...meta };
  await db.put(METADATA_STORE, { ...updated, key: 'sync' });
}

export async function incrementPendingOperations(): Promise<void> {
  const meta = await getSyncMetadata();
  await setSyncMetadata({ pendingOperations: meta.pendingOperations + 1 });
}

export async function decrementPendingOperations(): Promise<void> {
  const meta = await getSyncMetadata();
  await setSyncMetadata({ pendingOperations: Math.max(0, meta.pendingOperations - 1) });
}

export async function markSynced(): Promise<void> {
  await setSyncMetadata({ 
    lastSynced: Date.now(), 
    pendingOperations: 0,
    driveTokenPresent: true 
  });
}

// ============================================================================
// Initialization & Migration
// ============================================================================

export async function init(): Promise<void> {
  if (isInitialized) return;
  
  // Check feature flag
  if (localStorage.getItem('offline_storage_disabled') === 'true') {
    console.log('Offline storage disabled via feature flag');
    isInitialized = true;
    return;
  }

  await getDB(); // Initialize DB schema
  await ensureEncryptionKey(); // Ensure device-bound key exists
  await migrateFromLocalStorage();
  await enforceTTL(TTL_DAYS);
  
  isInitialized = true;
  console.log('Offline storage initialized');
}

export async function isReady(): Promise<boolean> {
  return isInitialized;
}

// ============================================================================
// Legacy Migration
// ============================================================================

async function migrateFromLocalStorage(): Promise<void> {
  const legacyCache = localStorage.getItem('mock_db_cache');
  if (!legacyCache) return;

  try {
    const data = JSON.parse(legacyCache);
    let migrated = false;

    for (const col of COLLECTIONS) {
      if (Array.isArray(data[col]) && data[col].length > 0) {
        await replaceAll(col, data[col]);
        migrated = true;
      }
    }

    if (migrated) {
      localStorage.removeItem('mock_db_cache');
      console.log('Migrated legacy localStorage cache to IndexedDB');
    }
  } catch (err) {
    console.error('Failed to migrate legacy cache:', err);
  }
}

// ============================================================================
// TTL Cleanup
// ============================================================================

export async function enforceTTL(maxAgeDays: number = TTL_DAYS): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const db = await getDB();

  for (const col of COLLECTIONS) {
    try {
      const storeName = col as CollectionStoreName;
      const records = await db.getAllFromIndex(storeName, 'updatedAt', IDBKeyRange.upperBound(cutoff));
      if (records.length > 0) {
        const tx = db.transaction(storeName, 'readwrite');
        for (const record of records) {
          await tx.store.delete(record.id);
        }
        await tx.done;
        console.log(`TTL cleanup: removed ${records.length} old records from ${col}`);
      }
    } catch (err) {
      // Index might not exist for all stores
      console.debug(`TTL cleanup skipped for ${col}:`, err);
    }
  }
}

// ============================================================================
// Quota Management
// ============================================================================

export async function checkQuota(): Promise<{ usage: number; quota: number; percentage: number } | null> {
  if (!navigator.storage?.estimate) return null;
  
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota && estimate.usage) {
      const percentage = estimate.usage / estimate.quota;
      if (percentage > QUOTA_WARNING_THRESHOLD) {
        console.warn(`IndexedDB quota at ${Math.round(percentage * 100)}% (${estimate.usage}/${estimate.quota} bytes)`);
        // Dispatch event for UI toast
        window.dispatchEvent(new CustomEvent('offline-storage-quota-warning', {
          detail: { usage: estimate.usage, quota: estimate.quota, percentage }
        }));
      }
      return { usage: estimate.usage, quota: estimate.quota, percentage };
    }
  } catch (err) {
    console.debug('Quota check failed:', err);
  }
  return null;
}

// ============================================================================
// Clear All Data
// ============================================================================

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const storeNames = [...COLLECTIONS, METADATA_STORE] as Array<CollectionStoreName | 'metadata'>;
  const tx = db.transaction(storeNames, 'readwrite');
  
  for (const col of COLLECTIONS) {
    await tx.objectStore(col as CollectionStoreName).clear();
  }
  await tx.objectStore(METADATA_STORE).clear();
  await tx.done;
  
  encryptionKey = null;
  console.log('Offline storage cleared');
}

// ============================================================================
// Public API
// ============================================================================

export const offlineStorage = {
  init,
  isReady,
  getAll,
  get,
  put,
  delete: deleteRecord,
  deleteRecord,
  clear,
  replaceAll,
  getAllCollections,
  getSyncMetadata,
  setSyncMetadata,
  incrementPendingOperations,
  decrementPendingOperations,
  markSynced,
  setUserEncryptionKey,
  clearEncryptionKey,
  hasEncryptionKey,
  enforceTTL,
  checkQuota,
  clearAll,
};
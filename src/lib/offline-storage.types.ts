/**
 * Type definitions for offline storage (IndexedDB) module
 */

export type CollectionName = 
  | 'patients' 
  | 'sessions' 
  | 'psychologists' 
  | 'audit_logs' 
  | 'patient_consents' 
  | 'note_versions';

export interface OfflineStoreConfig {
  name: CollectionName;
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

export interface EncryptedPayload {
  iv: string;           // base64
  ciphertext: string;   // base64
  tag: string;          // base64 (auth tag)
  salt: string;         // base64 (for key derivation)
  timestamp: number;    // for TTL
}

export interface SyncMetadata {
  lastSynced: number | null;
  pendingOperations: number;
  driveTokenPresent: boolean;
}

export interface OfflineStorageConfig {
  dbName: string;
  version: number;
  stores: OfflineStoreConfig[];
}

export interface StoredRecord {
  id: string;
  data: EncryptedPayload;
  updatedAt: number;
}

export interface DeviceKeyRecord {
  // `key` is the explicit IndexedDB key ('device-master-key'), not part of the
  // stored value, so it is optional here.
  key?: 'device-master-key';
  wrappedKey: string;   // base64 wrapped key
  algorithm: string;
}
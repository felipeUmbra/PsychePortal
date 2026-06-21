/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Note-level encryption at rest using AES-GCM 256.
 * This file is separate from ./crypto.ts (which holds audit SHA-256 helpers).
 */

import { WORD_LIST } from './word-list';

export const NOTE_ENCRYPTION_VERSION = 'v1';
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

// ---------------------------------------------------------------------------
// Recovery phrase helpers
// ---------------------------------------------------------------------------

export function generateRecoveryPhrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % WORD_LIST.length;
    words.push(WORD_LIST[idx]);
  }
  return words.join(' ');
}

export async function hashRecoveryPhrase(phrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Base64 helpers
// ---------------------------------------------------------------------------

export function base64Encode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
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

// ---------------------------------------------------------------------------
// Encryption / decryption
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64
  version: string;
}

export async function encryptNote(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return {
    ciphertext: base64Encode(ciphertext),
    iv: base64Encode(iv),
    version: NOTE_ENCRYPTION_VERSION,
  };
}

export async function decryptNote(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const iv = base64Decode(payload.iv);
  const data = base64Decode(payload.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}

// ---------------------------------------------------------------------------
// Field-level helpers (for anamnesis)
// ---------------------------------------------------------------------------

export type EncryptedFields = Record<string, EncryptedPayload>;

export const ANAMNESIS_FIELDS: readonly string[] = [
  'chiefComplaint',
  'medicalHistory',
  'psychiatricHistory',
  'familyHistory',
  'medications',
  'substanceUse',
  'familyStructure',
  'workStudies',
  'socialHabits',
  'psychiatricHistoryDetailed',
  'recurrentSymptoms',
  'predominantEmotions',
] as const;

// ---------------------------------------------------------------------------
// Field encrypt/decrypt
// ---------------------------------------------------------------------------

export async function encryptNoteFields(
  fields: Record<string, string>,
  key: CryptoKey,
): Promise<EncryptedFields> {
  const result: EncryptedFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v) {
      result[k] = await encryptNote(v, key);
    }
  }
  return result;
}

export async function decryptNoteFields(
  encrypted: EncryptedFields,
  key: CryptoKey,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(encrypted)) {
    try {
      result[k] = await decryptNote(v, key);
    } catch {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// IndexedDB key storage
// ---------------------------------------------------------------------------

const IDB_NAME = 'psycheportal_keys';
const IDB_STORE = 'encryption_keys';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredKeyRecord {
  salt: string;
  recoveryHash: string;
  createdAt: string;
}

export async function storeKeyRecord(
  uid: string,
  salt: Uint8Array,
  recoveryHash: string,
): Promise<void> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  const record: StoredKeyRecord = {
    salt: base64Encode(salt),
    recoveryHash,
    createdAt: new Date().toISOString(),
  };
  store.put(record, `user_${uid}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getKeyRecord(uid: string): Promise<StoredKeyRecord | null> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readonly');
  const store = tx.objectStore(IDB_STORE);
  const req = store.get(`user_${uid}`);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteKeyRecord(uid: string): Promise<void> {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  store.delete(`user_${uid}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Passphrase validation
// ---------------------------------------------------------------------------

export function isPassphraseValid(passphrase: string): boolean {
  return passphrase.length >= 12;
}

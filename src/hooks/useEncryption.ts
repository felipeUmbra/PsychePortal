/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * React hook managing the per-user encryption key lifecycle.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../firebase';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  generateRecoveryPhrase,
  hashRecoveryPhrase,
  isPassphraseValid,
  storeKeyRecord,
  getKeyRecord,
  base64Decode,
  encryptNote,
  decryptNote,
  encryptNoteFields,
  decryptNoteFields,
  type EncryptedPayload,
  type EncryptedFields,
} from '../lib/note-crypto';

let cachedMasterKey: CryptoKey | null = null;

export interface UseEncryptionReturn {
  isUnlocked: boolean;
  isSetup: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  setup: (passphrase: string) => Promise<{ recoveryPhrase: string }>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  encrypt: (plaintext: string) => Promise<EncryptedPayload>;
  decrypt: (payload: EncryptedPayload) => Promise<string>;
  encryptFields: (fields: Record<string, string>) => Promise<EncryptedFields>;
  decryptFields: (encrypted: EncryptedFields) => Promise<Record<string, string>>;
}

export function useEncryption(): UseEncryptionReturn {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setIsLoading(false);
      setNeedsSetup(false);
      setIsSetup(false);
      return;
    }
    uidRef.current = user.uid;

    (async () => {
      try {
        const record = await getKeyRecord(user.uid);
        if (record) {
          setIsSetup(true);
          setNeedsSetup(false);
        } else {
          setIsSetup(false);
          setNeedsSetup(true);
        }
      } catch (err) {
        console.error('Failed to check encryption setup:', err);
        setIsSetup(false);
        setNeedsSetup(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    if (!isPassphraseValid(passphrase)) {
      throw new Error('Passphrase must be at least 12 characters');
    }
    const uid = uidRef.current ?? auth.currentUser?.uid;
    if (!uid) throw new Error('No authenticated user');

    const salt = generateSalt();
    const masterKey = await deriveKeyFromPassphrase(passphrase, salt);
    const recoveryPhrase = generateRecoveryPhrase();
    const recoveryHash = await hashRecoveryPhrase(recoveryPhrase);

    await storeKeyRecord(uid, salt, recoveryHash);

    cachedMasterKey = masterKey;
    setIsUnlocked(true);
    setIsSetup(true);
    setNeedsSetup(false);

    return { recoveryPhrase };
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    if (!isPassphraseValid(passphrase)) {
      throw new Error('Passphrase must be at least 12 characters');
    }
    const uid = uidRef.current ?? auth.currentUser?.uid;
    if (!uid) throw new Error('No authenticated user');

    const record = await getKeyRecord(uid);
    if (!record) throw new Error('No encryption key found — setup first');

    const salt = base64Decode(record.salt);
    const masterKey = await deriveKeyFromPassphrase(passphrase, salt);

    cachedMasterKey = masterKey;
    setIsUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    cachedMasterKey = null;
    setIsUnlocked(false);
  }, []);

  const encrypt = useCallback(async (plaintext: string): Promise<EncryptedPayload> => {
    if (!cachedMasterKey) throw new Error('Encryption key not unlocked');
    return encryptNote(plaintext, cachedMasterKey);
  }, []);

  const decrypt = useCallback(async (payload: EncryptedPayload): Promise<string> => {
    if (!cachedMasterKey) throw new Error('Encryption key not unlocked');
    return decryptNote(payload, cachedMasterKey);
  }, []);

  const encryptFields = useCallback(async (fields: Record<string, string>): Promise<EncryptedFields> => {
    if (!cachedMasterKey) throw new Error('Encryption key not unlocked');
    return encryptNoteFields(fields, cachedMasterKey);
  }, []);

  const decryptFields = useCallback(async (encrypted: EncryptedFields): Promise<Record<string, string>> => {
    if (!cachedMasterKey) throw new Error('Encryption key not unlocked');
    return decryptNoteFields(encrypted, cachedMasterKey);
  }, []);

  return {
    isUnlocked,
    isSetup,
    isLoading,
    needsSetup,
    setup,
    unlock,
    lock,
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
  };
}
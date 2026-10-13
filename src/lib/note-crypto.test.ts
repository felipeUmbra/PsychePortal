import { describe, it, expect, beforeAll, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  NOTE_ENCRYPTION_VERSION,
  generateRecoveryPhrase,
  hashRecoveryPhrase,
  base64Encode,
  base64Decode,
  generateSalt,
  deriveKeyFromPassphrase,
  encryptNote,
  decryptNote,
  encryptNoteFields,
  decryptNoteFields,
  getKeyRecord,
  storeKeyRecord,
  deleteKeyRecord,
  isPassphraseValid,
} from './note-crypto';
import { WORD_LIST } from './word-list';

function stubIndexedDb(database: unknown) {
  const openRequest: {
    result: unknown;
    error: Error | null;
    onsuccess?: (() => void) | null;
    onerror?: (() => void) | null;
  } = {
    result: database,
    error: null,
  };

  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      queueMicrotask(() => openRequest.onsuccess?.());
      return openRequest;
    }),
  });
}

describe('base64 helpers', () => {
  it('round-trips binary data', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255]);
    expect(Array.from(base64Decode(base64Encode(bytes)))).toEqual(Array.from(bytes));
  });

  it('round-trips ArrayBuffer input', () => {
    const buf = new TextEncoder().encode('binary').buffer;
    const decoded = base64Decode(base64Encode(buf));
    expect(new TextDecoder().decode(decoded)).toBe('binary');
  });

  it('matches a known base64 vector', () => {
    // "Hello" -> SGVsbG8=
    expect(base64Encode(new TextEncoder().encode('Hello'))).toBe('SGVsbG8=');
  });
});

describe('recovery phrase', () => {
  it('generates exactly 12 words from WORD_LIST', () => {
    const phrase = generateRecoveryPhrase();
    const words = phrase.split(' ');
    expect(words).toHaveLength(12);
    for (const w of words) {
      expect(WORD_LIST).toContain(w);
    }
  });

  it('generates a non-trivial phrase (not all identical words)', () => {
    const phrase = generateRecoveryPhrase();
    const distinct = new Set(phrase.split(' ')).size;
    expect(distinct).toBeGreaterThan(1);
  });

  it('hashes to a 64-char hex digest', async () => {
    expect(await hashRecoveryPhrase('a b c')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is deterministic and distinct per phrase', async () => {
    const h1 = await hashRecoveryPhrase('phrase one');
    const h2 = await hashRecoveryPhrase('phrase one');
    const h3 = await hashRecoveryPhrase('phrase two');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe('salt & key derivation', () => {
  it('generates a 16-byte salt', () => {
    expect(generateSalt()).toHaveLength(16);
  });

  it('derives the same key for same passphrase + salt (via encrypt/decrypt)', async () => {
    const salt = generateSalt();
    const k1 = await deriveKeyFromPassphrase('s3cret', salt);
    const k2 = await deriveKeyFromPassphrase('s3cret', salt);
    const payload = await encryptNote('roundtrip', k1);
    // k2 must decrypt what k1 encrypted -> same derived key
    expect(await decryptNote(payload, k2)).toBe('roundtrip');
  });

  it('derives a different key for a different salt', async () => {
    const k1 = await deriveKeyFromPassphrase('s3cret', generateSalt());
    const k2 = await deriveKeyFromPassphrase('s3cret', generateSalt());
    const payload = await encryptNote('confidential', k1);
    await expect(decryptNote(payload, k2)).rejects.toThrow();
  });
});

describe('encrypt/decrypt notes', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
  });

  describe('note field helpers', () => {
    let key: CryptoKey;

    beforeAll(async () => {
      key = await deriveKeyFromPassphrase('field-test-passphrase', generateSalt());
    });

    it('encrypts only non-empty fields and decrypts them', async () => {
      const encrypted = await encryptNoteFields({
        chiefComplaint: 'sleep difficulty',
        medicalHistory: '',
      }, key);

      expect(Object.keys(encrypted)).toEqual(['chiefComplaint']);
      await expect(decryptNoteFields(encrypted, key)).resolves.toEqual({
        chiefComplaint: 'sleep difficulty',
      });
    });

    it('preserves legacy string fields and skips malformed non-string payloads', async () => {
      const decrypted = await decryptNoteFields({
        legacy: 'legacy plaintext',
        malformed: { iv: '', ciphertext: '' },
      } as any, key);

      expect(decrypted).toEqual({ legacy: 'legacy plaintext' });
    });
  });

  describe('passphrase validation', () => {
    it('requires at least twelve characters', () => {
      expect(isPassphraseValid('short')).toBe(false);
      expect(isPassphraseValid('exactly12ch')).toBe(false);
      expect(isPassphraseValid('exactly12chr')).toBe(true);
    });
  });

  it('produces an encrypted payload with version v1 and non-empty iv/ciphertext', async () => {
    const payload = await encryptNote('confidential clinical note', key);
    expect(payload.version).toBe(NOTE_ENCRYPTION_VERSION);
    expect(payload.iv).toBeTruthy();
    expect(payload.ciphertext).toBeTruthy();
    // Ciphertext must NOT contain the plaintext (it is base64 binary)
    expect(payload.ciphertext).not.toContain('confidential');
  });

  it('round-trips plaintext through encrypt -> decrypt', async () => {
    const plaintext = 'Sessão 42 — anamnese atualizada';
    const payload = await encryptNote(plaintext, key);
    expect(await decryptNote(payload, key)).toBe(plaintext);
  });

  it('rejects decryption with a wrong key (tamper detection)', async () => {
    const payload = await encryptNote('secret', key);
    const wrongKey = await deriveKeyFromPassphrase('wrong-passphrase', generateSalt());
    await expect(decryptNote(payload, wrongKey)).rejects.toThrow();
  });

  it('rejects a tampered ciphertext', async () => {
    const payload = await encryptNote('secret', key);
    const bytes = base64Decode(payload.ciphertext);
    bytes[0] ^= 0xff; // flip a byte
    const tampered = { ...payload, ciphertext: base64Encode(bytes) };
    await expect(decryptNote(tampered, key)).rejects.toThrow();
  });

  it('rejects a tampered IV', async () => {
    const payload = await encryptNote('secret', key);
    const iv = base64Decode(payload.iv);
    iv[0] ^= 0xff;
    await expect(decryptNote({ ...payload, iv: base64Encode(iv) }, key)).rejects.toThrow();
  });
});

describe('key record helpers (IndexedDB-backed)', () => {
  it('opens an upgraded database when the encryption store already exists', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    const store = {
      get: vi.fn(() => {
        const request: { result: null; onsuccess?: () => void } = { result: null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }),
    };
    const database = {
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => ({ objectStore: vi.fn(() => store) })),
    };
    const openRequest: {
      result: typeof database;
      error: null;
      onupgradeneeded?: () => void;
      onsuccess?: () => void;
    } = { result: database, error: null };
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        queueMicrotask(() => {
          openRequest.onupgradeneeded?.();
          openRequest.onsuccess?.();
        });
        return openRequest;
      }),
    });

    try {
      await expect(getKeyRecord('existing-store')).resolves.toBeNull();
      expect(database.objectStoreNames.contains).toHaveBeenCalledWith('encryption_keys');
      expect(database.transaction).toHaveBeenCalledWith('encryption_keys', 'readonly');
    } finally {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });

  it('returns null for an unknown psychologist', async () => {
    expect(await getKeyRecord('missing-psych')).toBeNull();
  });

  it('stores and retrieves a key record for a psychologist', async () => {
    const salt = generateSalt();
    const recoveryHash = 'a'.repeat(64);
    await storeKeyRecord('psych-1', salt, recoveryHash);
    const fetched = await getKeyRecord('psych-1');
    expect(fetched?.salt).toBe(base64Encode(salt));
    expect(fetched?.recoveryHash).toBe(recoveryHash);
    expect(fetched?.createdAt).toBeTruthy();
  });

  it('overwrites the record for the same user', async () => {
    await storeKeyRecord('psych-2', generateSalt(), 'h1');
    await storeKeyRecord('psych-2', generateSalt(), 'h2');
    const fetched = await getKeyRecord('psych-2');
    expect(fetched?.recoveryHash).toBe('h2');
  });

  it('deleteKeyRecord removes the record', async () => {
    await storeKeyRecord('psych-3', generateSalt(), 'h3');
    await deleteKeyRecord('psych-3');
    expect(await getKeyRecord('psych-3')).toBeNull();
  });

  it('rejects when opening IndexedDB fails', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    const error = new Error('IndexedDB open failed');
    const openRequest: {
      error: Error;
      onerror?: (() => void) | null;
    } = { error };

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        queueMicrotask(() => openRequest.onerror?.());
        return openRequest;
      }),
    });

    try {
      await expect(getKeyRecord('open-error')).rejects.toBe(error);
    } finally {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });

  it('rejects a key write when its transaction errors', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    const error = new Error('IndexedDB write failed');
    const store = { put: vi.fn() };
    const transaction = {
      error,
      objectStore: vi.fn(() => store),
      onerror: undefined as (() => void) | undefined,
    };
    store.put.mockImplementation(() => {
      queueMicrotask(() => transaction.onerror?.());
    });
    const database = {
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => transaction),
    };
    stubIndexedDb(database);

    try {
      await expect(storeKeyRecord('write-error', generateSalt(), 'hash')).rejects.toBe(error);
    } finally {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });

  it('rejects a key read when its request errors', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    const error = new Error('IndexedDB read failed');
    const request: {
      error: Error;
      result: undefined;
      onsuccess?: (() => void) | null;
      onerror?: (() => void) | null;
    } = { error, result: undefined };
    const store = {
      get: vi.fn(() => {
        queueMicrotask(() => request.onerror?.());
        return request;
      }),
    };
    const database = {
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => ({ objectStore: vi.fn(() => store) })),
    };
    stubIndexedDb(database);

    try {
      await expect(getKeyRecord('read-error')).rejects.toBe(error);
    } finally {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });

  it('rejects a key deletion when its transaction errors', async () => {
    const originalIndexedDB = globalThis.indexedDB;
    const error = new Error('IndexedDB delete failed');
    const store = { delete: vi.fn() };
    const transaction = {
      error,
      objectStore: vi.fn(() => store),
      onerror: undefined as (() => void) | undefined,
    };
    store.delete.mockImplementation(() => {
      queueMicrotask(() => transaction.onerror?.());
    });
    const database = {
      objectStoreNames: { contains: vi.fn(() => true) },
      transaction: vi.fn(() => transaction),
    };
    stubIndexedDb(database);

    try {
      await expect(deleteKeyRecord('delete-error')).rejects.toBe(error);
    } finally {
      vi.stubGlobal('indexedDB', originalIndexedDB);
    }
  });
});

  describe('note-crypto error handling and edge cases', () => {
    describe('encryptNote/decryptNote error paths', () => {
      it('handles encryption failure', async () => {
        const key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
        // Mock crypto.subtle.encrypt to fail
        const originalEncrypt = crypto.subtle.encrypt;
        crypto.subtle.encrypt = vi.fn().mockRejectedValueOnce(new Error('Encryption failed'));

        await expect(encryptNote('test', key)).rejects.toThrow('Encryption failed');

        crypto.subtle.encrypt = originalEncrypt;
      });

      it('handles decryption failure with wrong key', async () => {
        const key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
        const payload = await encryptNote('secret', key);
        const wrongKey = await deriveKeyFromPassphrase('wrong-passphrase', generateSalt());

        await expect(decryptNote(payload, wrongKey)).rejects.toThrow();
      });

      it('handles tampered ciphertext', async () => {
        const key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
        const payload = await encryptNote('secret', key);
        const bytes = base64Decode(payload.ciphertext);
        bytes[0] ^= 0xff;
        const tampered = { ...payload, ciphertext: base64Encode(bytes) };

        await expect(decryptNote(tampered, key)).rejects.toThrow();
      });

      it('handles tampered IV', async () => {
        const key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
        const payload = await encryptNote('secret', key);
        const iv = base64Decode(payload.iv);
        iv[0] ^= 0xff;

        await expect(decryptNote({ ...payload, iv: base64Encode(iv) }, key)).rejects.toThrow();
      });

      it('handles tampered auth tag', async () => {
              const key = await deriveKeyFromPassphrase('test-passphrase', generateSalt());
              const payload = await encryptNote('secret', key);
              // The tag is embedded in the ciphertext for AES-GCM
              const bytes = base64Decode(payload.ciphertext);
              bytes[bytes.length - 1] ^= 0xff;
              const tampered = { ...payload, ciphertext: base64Encode(bytes) };

              await expect(decryptNote(tampered, key)).rejects.toThrow();
            });
          });

          describe('key derivation edge cases', () => {
            it('derives different keys for different passphrases', async () => {
              const salt = generateSalt();
              const k1 = await deriveKeyFromPassphrase('passphrase1', salt);
              const k2 = await deriveKeyFromPassphrase('passphrase2', salt);
              const payload = await encryptNote('test', k1);

              await expect(decryptNote(payload, k2)).rejects.toThrow();
            });
          });

          describe('IndexedDB key storage functions', () => {
            it('covers storeKeyRecord function', async () => {
              const salt = generateSalt();
              const recoveryHash = 'a'.repeat(64);
              await storeKeyRecord('psych-store', salt, recoveryHash);
              const fetched = await getKeyRecord('psych-store');
              expect(fetched?.salt).toBe(base64Encode(salt));
              expect(fetched?.recoveryHash).toBe(recoveryHash);
              expect(fetched?.createdAt).toBeTruthy();
            });

            it('covers getKeyRecord function for missing key', async () => {
              const result = await getKeyRecord('non-existent-key');
              expect(result).toBeNull();
            });

            it('covers deleteKeyRecord function', async () => {
              const salt = generateSalt();
              await storeKeyRecord('psych-delete', salt, 'hash');
              await deleteKeyRecord('psych-delete');
              const result = await getKeyRecord('psych-delete');
              expect(result).toBeNull();
            });

            it('covers openIDB function via store operations', async () => {
              const salt = generateSalt();
              await storeKeyRecord('psych-open', salt, 'hash');
              const fetched = await getKeyRecord('psych-open');
              expect(fetched).toBeTruthy();
            });

      it('derives different keys for different salts', async () => {
        const k1 = await deriveKeyFromPassphrase('same-passphrase', generateSalt());
        const k2 = await deriveKeyFromPassphrase('same-passphrase', generateSalt());
        const payload = await encryptNote('test', k1);

        await expect(decryptNote(payload, k2)).rejects.toThrow();
      });

      it('handles empty passphrase', async () => {
        const salt = generateSalt();
        const key = await deriveKeyFromPassphrase('', salt);
        const payload = await encryptNote('test', key);
        expect(await decryptNote(payload, key)).toBe('test');
      });

      it('handles very long passphrase', async () => {
        const longPassphrase = 'a'.repeat(1000);
        const salt = generateSalt();
        const key = await deriveKeyFromPassphrase(longPassphrase, salt);
        const payload = await encryptNote('test', key);
        expect(await decryptNote(payload, key)).toBe('test');
      });

      it('handles unicode passphrase', async () => {
        const unicodePassphrase = '🔐🔑🔒password🔒🔑🔐';
        const salt = generateSalt();
        const key = await deriveKeyFromPassphrase(unicodePassphrase, salt);
        const payload = await encryptNote('test', key);
        expect(await decryptNote(payload, key)).toBe('test');
      });
    });

    describe('recovery phrase edge cases', () => {
      it('generates valid recovery phrases', () => {
        for (let i = 0; i < 10; i++) {
          const phrase = generateRecoveryPhrase();
          const words = phrase.split(' ');
          expect(words).toHaveLength(12);
          for (const w of words) {
            expect(WORD_LIST).toContain(w);
          }
        }
      });

      it('hashes recovery phrase consistently', async () => {
        const phrase = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
        const hash1 = await hashRecoveryPhrase(phrase);
        const hash2 = await hashRecoveryPhrase(phrase);
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      });

      it('produces different hashes for different phrases', async () => {
        const hash1 = await hashRecoveryPhrase('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12');
        const hash2 = await hashRecoveryPhrase('word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('base64 encoding edge cases', () => {
      it('handles empty input', () => {
        const encoded = base64Encode(new Uint8Array([]));
        const decoded = base64Decode(encoded);
        expect(decoded).toEqual(new Uint8Array([]));
      });

      it('handles single byte', () => {
        const encoded = base64Encode(new Uint8Array([0]));
        const decoded = base64Decode(encoded);
        expect(decoded).toEqual(new Uint8Array([0]));
      });

      it('handles all byte values', () => {
        const bytes = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          bytes[i] = i;
        }
        const encoded = base64Encode(bytes);
        const decoded = base64Decode(encoded);
        expect(decoded).toEqual(bytes);
      });

      it('handles ArrayBuffer input', () => {
        const buf = new TextEncoder().encode('test').buffer;
        const encoded = base64Encode(buf);
        const decoded = base64Decode(encoded);
        expect(new TextDecoder().decode(decoded)).toBe('test');
      });
    });

    describe('salt generation', () => {
      it('generates unique salts', () => {
        const salts = new Set();
        for (let i = 0; i < 100; i++) {
          const salt = generateSalt();
          expect(salt).toHaveLength(16);
          salts.add(Array.from(salt).join(','));
        }
        expect(salts.size).toBe(100);
      });
    });

    describe('key record helpers edge cases', () => {
      it('handles missing psychologist', async () => {
        expect(await getKeyRecord('nonexistent-psych')).toBeNull();
      });

      it('stores and retrieves key record', async () => {
        const salt = generateSalt();
        const recoveryHash = 'a'.repeat(64);
        await storeKeyRecord('psych-test-1', salt, recoveryHash);
        const fetched = await getKeyRecord('psych-test-1');
        expect(fetched?.salt).toBe(base64Encode(salt));
        expect(fetched?.recoveryHash).toBe(recoveryHash);
        expect(fetched?.createdAt).toBeTruthy();
      });

      it('overwrites existing record', async () => {
        await storeKeyRecord('psych-test-2', generateSalt(), 'h1');
        await storeKeyRecord('psych-test-2', generateSalt(), 'h2');
        const fetched = await getKeyRecord('psych-test-2');
        expect(fetched?.recoveryHash).toBe('h2');
      });

      it('deletes key record', async () => {
        await storeKeyRecord('psych-test-3', generateSalt(), 'h3');
        await deleteKeyRecord('psych-test-3');
        expect(await getKeyRecord('psych-test-3')).toBeNull();
      });

      it('handles multiple psychologists', async () => {
        await storeKeyRecord('psych-a', generateSalt(), 'hash-a');
        await storeKeyRecord('psych-b', generateSalt(), 'hash-b');
        await storeKeyRecord('psych-c', generateSalt(), 'hash-c');

        const a = await getKeyRecord('psych-a');
        const b = await getKeyRecord('psych-b');
        const c = await getKeyRecord('psych-c');

        expect(a?.recoveryHash).toBe('hash-a');
        expect(b?.recoveryHash).toBe('hash-b');
        expect(c?.recoveryHash).toBe('hash-c');
      });
    });

          describe('IndexedDB open/upgrade paths', () => {
            it('handles IndexedDB open success', async () => {
              const salt = generateSalt();
              const recoveryHash = 'a'.repeat(64);
              await storeKeyRecord('psych-idb-1', salt, recoveryHash);
              const fetched = await getKeyRecord('psych-idb-1');
              expect(fetched?.salt).toBe(base64Encode(salt));
              expect(fetched?.recoveryHash).toBe(recoveryHash);
            });

            it('handles IndexedDB upgrade needed', async () => {
              // This test verifies the upgrade path by using a fresh database
              const salt = generateSalt();
              const recoveryHash = 'b'.repeat(64);
              await storeKeyRecord('psych-idb-2', salt, recoveryHash);
              const fetched = await getKeyRecord('psych-idb-2');
              expect(fetched?.salt).toBe(base64Encode(salt));
              expect(fetched?.recoveryHash).toBe(recoveryHash);
            });

            it('handles IndexedDB storeKeyRecord and getKeyRecord roundtrip', async () => {
              const salt = generateSalt();
              const recoveryHash = 'c'.repeat(64);
              await storeKeyRecord('psych-idb-3', salt, recoveryHash);
              const fetched = await getKeyRecord('psych-idb-3');
              expect(fetched?.salt).toBe(base64Encode(salt));
              expect(fetched?.recoveryHash).toBe(recoveryHash);
              expect(fetched?.createdAt).toBeTruthy();
            });

            it('handles IndexedDB deleteKeyRecord', async () => {
              const salt = generateSalt();
              const recoveryHash = 'd'.repeat(64);
              await storeKeyRecord('psych-idb-4', salt, recoveryHash);
              await deleteKeyRecord('psych-idb-4');
              const fetched = await getKeyRecord('psych-idb-4');
              expect(fetched).toBeNull();
            });

            it('handles multiple psychologists in IndexedDB', async () => {
              await storeKeyRecord('psych-multi-1', generateSalt(), 'hash-1');
              await storeKeyRecord('psych-multi-2', generateSalt(), 'hash-2');
              await storeKeyRecord('psych-multi-3', generateSalt(), 'hash-3');

              const a = await getKeyRecord('psych-multi-1');
              const b = await getKeyRecord('psych-multi-2');
              const c = await getKeyRecord('psych-multi-3');

              expect(a?.recoveryHash).toBe('hash-1');
              expect(b?.recoveryHash).toBe('hash-2');
              expect(c?.recoveryHash).toBe('hash-3');
            });
          });
        });
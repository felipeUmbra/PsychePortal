import { describe, it, expect, beforeAll } from 'vitest';
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
  getKeyRecord,
  storeKeyRecord,
  deleteKeyRecord,
} from './note-crypto';
import { WORD_LIST } from './word-list';

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
});
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

import {
  createMockUser,
  createMockAuthStateChanged,
} from '../test/test-utils';

vi.mock('../firebase', () => ({
  auth: {
    currentUser: createMockUser('test-uid-123'),
    onAuthStateChanged: createMockAuthStateChanged(createMockUser('test-uid-123')),
  },
}));

vi.mock('../lib/note-crypto', () => ({
  generateSalt: vi.fn(() => new Uint8Array(16)),
  deriveKeyFromPassphrase: vi.fn(() => Promise.resolve({})),
  generateRecoveryPhrase: vi.fn(() => 'recovery phrase word word word word word word word word word word word word'),
  hashRecoveryPhrase: vi.fn(() => Promise.resolve('hashed-recovery')),
  isPassphraseValid: vi.fn((p: string) => p.length >= 12),
  storeKeyRecord: vi.fn(() => Promise.resolve()),
  getKeyRecord: vi.fn(() => Promise.resolve(null)),
  deleteKeyRecord: vi.fn(() => Promise.resolve()),
  base64Decode: vi.fn((s: string) => new Uint8Array([1, 2, 3])),
  encryptNote: vi.fn(() => Promise.resolve({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' })),
  decryptNote: vi.fn(() => Promise.resolve('decrypted text')),
  encryptNoteFields: vi.fn(() => Promise.resolve({ field1: { version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' } })),
  decryptNoteFields: vi.fn(() => Promise.resolve({ field1: 'decrypted' })),
}));

import { useEncryption, resetCachedMasterKeyForTesting } from './useEncryption';
import { auth } from '../firebase';
import * as noteCrypto from '../lib/note-crypto';

describe('useEncryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCachedMasterKeyForTesting();
    Object.defineProperty(auth, 'currentUser', {
      value: createMockUser('test-uid-123'),
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation(createMockAuthStateChanged(createMockUser('test-uid-123')));
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue(null);
    vi.mocked(noteCrypto.isPassphraseValid).mockReturnValue(true);
    vi.mocked(noteCrypto.generateRecoveryPhrase).mockReturnValue('recovery phrase word word word word word word word word word word word word');
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.hashRecoveryPhrase).mockResolvedValue('hashed');
    vi.mocked(noteCrypto.storeKeyRecord).mockResolvedValue(undefined);
    vi.mocked(noteCrypto.deleteKeyRecord).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetCachedMasterKeyForTesting();
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useEncryption());
    expect(result.current.isLoading).toBe(true);
  });

  it('sets needsSetup when no key record exists', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue(null);
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSetup).toBe(false);
    expect(result.current.needsSetup).toBe(true);
  });

  it('sets isSetup when key record exists', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'salt', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSetup).toBe(true);
    expect(result.current.needsSetup).toBe(false);
  });

  it('sets up encryption with valid passphrase', async () => {
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const setupResult = await act(async () => {
      return await result.current.setup('valid-passphrase-123');
    });

    expect(setupResult.recoveryPhrase).toBeDefined();
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.isSetup).toBe(true);
    expect(result.current.needsSetup).toBe(false);
    expect(noteCrypto.storeKeyRecord).toHaveBeenCalledWith('test-uid-123', expect.any(Uint8Array), 'hashed');
  });

  it('rejects setup with invalid passphrase', async () => {
    vi.mocked(noteCrypto.isPassphraseValid).mockReturnValue(false);
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(act(async () => {
      await result.current.setup('short');
    })).rejects.toThrow('Passphrase must be at least 12 characters');
  });

  it('unlocks with valid passphrase', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    expect(result.current.isUnlocked).toBe(true);
    expect(noteCrypto.deriveKeyFromPassphrase).toHaveBeenCalledWith('valid-passphrase-123', expect.any(Uint8Array));
  });

  it('rejects unlock with invalid passphrase', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.isPassphraseValid).mockReturnValue(false);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(act(async () => {
      await result.current.unlock('short');
    })).rejects.toThrow('Passphrase must be at least 12 characters');
  });

  it('rejects unlock when no key record exists', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue(null);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(act(async () => {
      await result.current.unlock('valid-passphrase-123');
    })).rejects.toThrow('No encryption key found — setup first');
  });

  it('locks encryption', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    expect(result.current.isUnlocked).toBe(true);

    act(() => {
      result.current.lock();
    });

    expect(result.current.isUnlocked).toBe(false);
  });

  it('disables encryption', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.deleteKeyRecord).mockResolvedValue(undefined);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    await act(async () => {
      await result.current.disable();
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isSetup).toBe(false);
    expect(result.current.needsSetup).toBe(true);
    expect(noteCrypto.deleteKeyRecord).toHaveBeenCalledWith('test-uid-123');
  });

  it('encrypts plaintext when unlocked', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.encryptNote).mockResolvedValue({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' });

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    const encrypted = await act(async () => {
      return await result.current.encrypt('plaintext');
    });

    expect(encrypted).toEqual({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' });
    expect(noteCrypto.encryptNote).toHaveBeenCalledWith('plaintext', expect.anything());
  });

  it('rejects encrypt when locked', async () => {
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.encrypt('plaintext')).rejects.toThrow('Encryption key not unlocked');
  });

  it('decrypts payload when unlocked', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.decryptNote).mockResolvedValue('decrypted text');

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    const decrypted = await act(async () => {
      return await result.current.decrypt({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' });
    });

    expect(decrypted).toBe('decrypted text');
    expect(noteCrypto.decryptNote).toHaveBeenCalledWith({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }, expect.anything());
  });

  it('rejects decrypt when locked', async () => {
    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.decrypt({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' })).rejects.toThrow('Encryption key not unlocked');
  });

  it('encrypts fields when unlocked', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.encryptNoteFields).mockResolvedValue({ field1: { version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' } });

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    const encrypted = await act(async () => {
      return await result.current.encryptFields({ field1: 'value1' });
    });

    expect(encrypted).toEqual({ field1: { version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' } });
  });

  it('decrypts fields when unlocked', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);
    vi.mocked(noteCrypto.decryptNoteFields).mockResolvedValue({ field1: 'decrypted' });

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    const decrypted = await act(async () => {
      return await result.current.decryptFields({ field1: { version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' } });
    });

    expect(decrypted).toEqual({ field1: 'decrypted' });
  });

  it('listens for session-timeout event', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockResolvedValue({ salt: 'c2FsdA==', recoveryHash: 'hash', createdAt: new Date().toISOString() });
    vi.mocked(noteCrypto.base64Decode).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(noteCrypto.deriveKeyFromPassphrase).mockResolvedValue({} as any);

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.unlock('valid-passphrase-123');
    });

    expect(result.current.isUnlocked).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent('session-timeout'));
    });

    expect(result.current.isUnlocked).toBe(false);
  });

  it('handles missing user gracefully', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation((cb: (user: User | null) => void) => {
      cb(null);
      return vi.fn();
    });

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSetup).toBe(false);
    expect(result.current.needsSetup).toBe(false);
  });

  it('handles getKeyRecord error gracefully', async () => {
    vi.mocked(noteCrypto.getKeyRecord).mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useEncryption());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSetup).toBe(false);
    expect(result.current.needsSetup).toBe(true);
  });
});
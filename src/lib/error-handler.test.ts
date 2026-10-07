import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFirestoreError, OperationType } from './error-handler';

vi.mock('../firebase', () => ({
  auth: {
    currentUser: {
      uid: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [
        { providerId: 'google.com', displayName: 'Test User', email: 'test@example.com', photoURL: 'https://photo.url' },
      ],
    },
  },
}));

import { auth } from '../firebase';

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('handles Error instance', () => {
    const error = new Error('Test error');
    
    handleFirestoreError(error, OperationType.CREATE, 'patients');

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('Test error'));
  });

  it('handles string error', () => {
    handleFirestoreError('String error message', OperationType.UPDATE, 'sessions/123');

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('String error message'));
  });

  it('handles non-Error, non-string error', () => {
    handleFirestoreError({ code: 'PERMISSION_DENIED' }, OperationType.DELETE, 'patients/456');

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('[object Object]'));
  });

  it('includes operation type', () => {
    handleFirestoreError(new Error('test'), OperationType.LIST, 'sessions');

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('"operationType":"list"'));
  });

  it('includes path', () => {
    handleFirestoreError(new Error('test'), OperationType.GET, 'patients/789');

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('"path":"patients/789"'));
  });

  it('includes null path when null', () => {
    handleFirestoreError(new Error('test'), OperationType.CREATE, null);

    expect(console.error).toHaveBeenCalledWith('Firestore Error: ', expect.stringContaining('"path":null'));
  });

  it('includes auth info when user exists', () => {
    handleFirestoreError(new Error('test'), OperationType.CREATE, 'patients');

    const logged = vi.mocked(console.error).mock.calls[0][1];
    const parsed = JSON.parse(logged);
    
    expect(parsed.authInfo).toEqual({
      userId: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: [
        { providerId: 'google.com', displayName: 'Test User', email: 'test@example.com', photoUrl: 'https://photo.url' },
      ],
    });
  });

  it('includes auth info with undefined user', () => {
    Object.defineProperty(auth, 'currentUser', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    
    handleFirestoreError(new Error('test'), OperationType.CREATE, 'patients');

    const logged = vi.mocked(console.error).mock.calls[0][1];
    const parsed = JSON.parse(logged);
    
    expect(parsed.authInfo).toEqual({
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: [],
    });
  });

  it('includes auth info with null user', () => {
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      writable: true,
      configurable: true,
    });
    
    handleFirestoreError(new Error('test'), OperationType.CREATE, 'patients');

    const logged = vi.mocked(console.error).mock.calls[0][1];
    const parsed = JSON.parse(logged);
    
    expect(parsed.authInfo).toEqual({
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: [],
    });
  });

  it('includes provider info when available', () => {
    Object.defineProperty(auth, 'currentUser', {
      value: {
        uid: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: null,
        providerData: [
          { providerId: 'google.com', displayName: 'Test User', email: 'test@example.com', photoURL: 'https://photo.url' },
          { providerId: 'password', displayName: null, email: 'test@example.com', photoURL: null },
        ],
      },
      writable: true,
      configurable: true,
    });
    
    handleFirestoreError(new Error('test'), OperationType.CREATE, 'patients');

    const logged = vi.mocked(console.error).mock.calls[0][1];
    const parsed = JSON.parse(logged);
    
    expect(parsed.authInfo.providerInfo).toHaveLength(2);
    expect(parsed.authInfo.providerInfo[0]).toEqual({
      providerId: 'google.com',
      displayName: 'Test User',
      email: 'test@example.com',
      photoUrl: 'https://photo.url',
    });
    expect(parsed.authInfo.providerInfo[1]).toEqual({
      providerId: 'password',
      displayName: null,
      email: 'test@example.com',
      photoUrl: null,
    });
  });

  it('does not throw error', () => {
    expect(() => {
      handleFirestoreError(new Error('test'), OperationType.CREATE, 'patients');
    }).not.toThrow();
  });

  it('logs all operation types correctly', () => {
    const operations = [
      OperationType.CREATE,
      OperationType.UPDATE,
      OperationType.DELETE,
      OperationType.LIST,
      OperationType.GET,
    ];

    operations.forEach(op => {
      vi.mocked(console.error).mockClear();
      handleFirestoreError(new Error('test'), op, 'test/path');
      const logged = vi.mocked(console.error).mock.calls[0][1];
      const parsed = JSON.parse(logged);
      expect(parsed.operationType).toBe(op);
    });
  });
});
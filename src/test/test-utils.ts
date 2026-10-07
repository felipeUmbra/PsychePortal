// Test utilities for proper Firestore mock typing
import { vi } from 'vitest';
import type { DocumentSnapshot, QuerySnapshot } from '@firebase/firestore';
import type { User, Unsubscribe } from '@firebase/auth';

// Properly typed mock DocSnapshot
export function createMockDocSnapshot<T = any>(id: string, data: T): DocumentSnapshot<T> {
  return {
    id,
    _data: data,
    exists: () => true,
    data: () => data,
    ref: {} as any,
    metadata: { hasPendingWrites: false, fromCache: false },
    isEqual: (other: DocumentSnapshot<T>) => other.id === id,
  } as DocumentSnapshot<T>;
}

// Properly typed mock QuerySnapshot
export function createMockQuerySnapshot<T = any>(docs: DocumentSnapshot<T>[]): QuerySnapshot<T> {
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    docChanges: () => [],
    forEach: (callback: (doc: DocumentSnapshot<T>) => void) => docs.forEach(callback),
    isEqual: (other: QuerySnapshot<T>) => other.docs.length === docs.length,
  } as unknown as QuerySnapshot<T>;
}

// Properly typed mock User
export function createMockUser(uid: string): User {
  return {
    uid,
    email: `test-${uid}@example.com`,
    displayName: 'Test User',
    photoURL: '',
    emailVerified: true,
    isAnonymous: false,
    metadata: { creationTime: '', lastSignInTime: '' },
    providerData: [],
    refreshToken: '',
    tenantId: null,
    phoneNumber: null,
    providerId: 'firebase',
    delete: vi.fn(),
    getIdToken: vi.fn(),
    getIdTokenResult: vi.fn(),
    reload: vi.fn(),
    toJSON: () => ({}),
  } as User;
}

// Mock Unsubscribe function
export function createMockUnsubscribe(): Unsubscribe {
  return vi.fn();
}

// Mock Firestore functions
export function createMockCollectionRef(path: string) {
  return { type: 'collection', path };
}

export function createMockQuery(conditions: any[] = []) {
  return { type: 'query', conditions };
}

export function createMockWhere(field: string, op: string, val: any) {
  return { type: 'where', field, op, val };
}

export function createMockOrderBy(field: string, dir: string) {
  return { type: 'orderBy', field, dir };
}

export function createMockLimit(num: number) {
  return { type: 'limit', num };
}

export function createMockDocRef(path: string, id: string) {
  return { type: 'doc', path, id };
}

// Mock onAuthStateChanged callback
export function createMockAuthStateChanged(user: User | null) {
  return vi.fn((cb: (user: User | null) => void) => {
    cb(user);
    return vi.fn();
  });
}
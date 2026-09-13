// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { cleanAllCollections, makeDelegates } from '../test/firestore-mock-bootstrap';

// --- Mock firebase/firestore (delegating to firestore-mock) ---
const mockFstore = vi.hoisted(() => ({ delegates: null as any }));
vi.mock('firebase/firestore', () => ({
  get collection() { return mockFstore.delegates.collection; },
  get doc() { return mockFstore.delegates.doc; },
  get query() { return mockFstore.delegates.query; },
  get where() { return mockFstore.delegates.where; },
  get orderBy() { return mockFstore.delegates.orderBy; },
  get limit() { return mockFstore.delegates.limit; },
  get getDocs() { return mockFstore.delegates.getDocs; },
  get getDoc() { return mockFstore.delegates.getDoc; },
  get addDoc() { return mockFstore.delegates.addDoc; },
  get setDoc() { return mockFstore.delegates.setDoc; },
  get updateDoc() { return mockFstore.delegates.updateDoc; },
  get deleteDoc() { return mockFstore.delegates.deleteDoc; },
  get onSnapshot() { return mockFstore.delegates.onSnapshot; },
  get serverTimestamp() { return mockFstore.delegates.serverTimestamp; },
}));

const mockDb = vi.hoisted(() => ({ value: null as any }));
vi.mock('../firebase', () => ({
  get db() { return mockDb.value; },
  auth: { currentUser: { uid: 'hook-user', email: 'hook@test.com' } },
}));

// --- Mock react-firebase-hooks/auth ---
const MOCK_USER = { uid: 'hook-user', email: 'hook@test.com' };
const mockUseAuthState = vi.hoisted(() => vi.fn(() => [MOCK_USER, false]));
vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: mockUseAuthState,
}));

import * as firestoreMock from '../lib/firestore-mock';
import { useAllSessions } from './useAllSessions';

const PSYCH = 'hook-user';

async function boot() {
  mockFstore.delegates = makeDelegates(firestoreMock);
  mockDb.value = firestoreMock.getFirestore();
  firestoreMock.setDriveToken('test-token');
  await new Promise((r) => setTimeout(r, 15));
}

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
  mockUseAuthState.mockReturnValue([MOCK_USER, false]);
  await boot();
  await cleanAllCollections(firestoreMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAllSessions', () => {
  it('starts with loading true and empty sessions', () => {
    const { result } = renderHook(() => useAllSessions());
    expect(result.current.loading).toBe(true);
    expect(result.current.sessions).toEqual([]);
  });

  it('loads sessions for the authenticated psychologist', async () => {
    await firestoreMock.addDoc(firestoreMock.collection({}, 'sessions'), {
      psychologistId: PSYCH,
      patientId: 'p1',
      date: '2026-09-01T10:00:00.000Z',
      duration: 50,
      type: 'individual',
      status: 'completed',
    });
    await firestoreMock.addDoc(firestoreMock.collection({}, 'sessions'), {
      psychologistId: 'other-user',
      patientId: 'p2',
      date: '2026-09-02T10:00:00.000Z',
      duration: 60,
      type: 'couple',
      status: 'scheduled',
    });

    const { result } = renderHook(() => useAllSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].patientId).toBe('p1');
  });

  it('returns empty sessions and loading false when user is null', async () => {
    mockUseAuthState.mockReturnValue([null, false]);

    const { result } = renderHook(() => useAllSessions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual([]);
  });
});

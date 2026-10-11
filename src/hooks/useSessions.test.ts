// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

import {
  createMockUser,
  createMockAuthStateChanged,
} from '../test/test-utils';

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

// Create a stable user reference
const mockUser = createMockUser('test-uid-123');

vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: vi.fn(() => [mockUser, true]),
}));

vi.mock('../lib/error-handler', () => ({
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'LIST', CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE', GET: 'GET' },
}));

vi.mock('../context/GoogleAuthContext', () => ({
  useGoogleAuth: () => ({
    driveToken: 'mock-drive-token',
    calendarToken: 'mock-calendar-token',
  }),
}));

vi.mock('./useEncryption', () => ({
  useEncryption: () => ({
    isUnlocked: true,
    encrypt: vi.fn(async (text: string) => ({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' })),
    decrypt: vi.fn(async (payload: any) => 'decrypted text'),
  }),
}));

vi.mock('../lib/note-versioning', () => ({
  saveNextNoteVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../lib/firestore-mock', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  getStorage: vi.fn(),
  deleteObject: vi.fn(),
  setDriveToken: vi.fn(),
}));

import { useSessions } from './useSessions';
import * as firestore from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

describe('useSessions', () => {
  const mockCollection = vi.fn();
  const mockQuery = vi.fn();
  const mockWhere = vi.fn();
  const mockOrderBy = vi.fn();
  const mockOnSnapshot = vi.fn();
  const mockAddDoc = vi.fn();
  const mockDoc = vi.fn();
  const mockUpdateDoc = vi.fn();
  const mockDeleteDoc = vi.fn();
  const mockGetDoc = vi.fn();
  const mockGetDocs = vi.fn();
  const mockLimit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthState).mockReturnValue([createMockUser('test-uid-123'), false]);

    vi.mocked(firestore.collection).mockImplementation(mockCollection);
    vi.mocked(firestore.query).mockImplementation(mockQuery);
    vi.mocked(firestore.where).mockImplementation(mockWhere);
    vi.mocked(firestore.orderBy).mockImplementation(mockOrderBy);
    vi.mocked(firestore.onSnapshot).mockImplementation(mockOnSnapshot);
    vi.mocked(firestore.addDoc).mockImplementation(mockAddDoc);
    vi.mocked(firestore.doc).mockImplementation(mockDoc);
    vi.mocked(firestore.updateDoc).mockImplementation(mockUpdateDoc);
    vi.mocked(firestore.deleteDoc).mockImplementation(mockDeleteDoc);
    vi.mocked(firestore.getDoc).mockImplementation(mockGetDoc);
    vi.mocked(firestore.getDocs).mockImplementation(mockGetDocs);
    vi.mocked(firestore.limit).mockImplementation(mockLimit);

    // Default mock implementations
    mockCollection.mockReturnValue({ path: 'sessions' });
    mockQuery.mockReturnValue({ path: 'sessions', conditions: [] });
    mockWhere.mockReturnValue({ type: 'where' });
    mockOrderBy.mockReturnValue({ type: 'orderBy' });
    mockLimit.mockReturnValue({ type: 'limit' });
    mockOnSnapshot.mockImplementation((q, callback) => {
          // Call callback asynchronously with a small delay to allow initial render with loading=true
          setTimeout(() => callback({ docs: [] }), 10);
          return vi.fn();
        });
    mockAddDoc.mockResolvedValue({ id: 'new-session-id' });
    mockDoc.mockReturnValue({ path: 'sessions', id: 'session-1' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ notes: 'existing notes' }) });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useSessions('patient-1'));
    expect(result.current.loading).toBe(true);
  });

  it('sets loading to false when no user', async () => {
    vi.mocked(useAuthState).mockReturnValue([null, false]);

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual([]);
  });

  it('sets loading to false when no patientId', async () => {
    const { result } = renderHook(() => useSessions(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual([]);
  });

  it('fetches sessions for patient', async () => {
    const mockSessions = [
      { id: '1', data: () => ({ patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'completed', type: 'individual', notes: 'note 1' }) },
      { id: '2', data: () => ({ patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'scheduled', type: 'individual', notes: 'note 2' }) },
    ];

    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: mockSessions });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].id).toBe('1');
    expect(result.current.sessions[1].id).toBe('2');
  });

  it('adds a new session', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const sessionId = await act(async () => {
      return await result.current.addSession({
        date: new Date(),
        status: 'scheduled',
        type: 'individual',
        notes: 'Test session',
      });
    });

    expect(sessionId).toBe('new-session-id');
    expect(firestore.addDoc).toHaveBeenCalled();
  });

  it('updates a session', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSession('session-1', { status: 'completed' });
    });

    expect(firestore.updateDoc).toHaveBeenCalled();
  });

  it('cancels a session', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.cancelSession({ id: 'session-1', googleEventId: 'event-1' } as any);
    });

    expect(firestore.updateDoc).toHaveBeenCalled();
  });

  it('deletes a session', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteSession('session-1');
    });

    expect(firestore.deleteDoc).toHaveBeenCalled();
  });

  it('handles error in addSession', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });
    mockAddDoc.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.addSession({
          date: new Date(),
          status: 'scheduled',
          type: 'individual',
          notes: 'Test session',
        });
      })
    ).rejects.toThrow('Network error');
  });

  it('handles error in updateSession', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });
    mockUpdateDoc.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.updateSession('session-1', { status: 'completed' });
      })
    ).rejects.toThrow('Network error');
  });

  it('handles error in deleteSession', async () => {
    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: [] });
      return vi.fn();
    });
    mockDeleteDoc.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.deleteSession('session-1');
      })
    ).rejects.toThrow('Network error');
  });

  it('cleans up listener on unmount', async () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { result, unmount } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
    }, 15000);

  it('decrypts notes when encryption is unlocked', async () => {
    const mockSessions = [
      { id: '1', data: () => ({ patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'completed', type: 'individual', notes: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) }) },
    ];

    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: mockSessions });
      return vi.fn();
    });

    const { result } = renderHook(() => useSessions('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Wait for decryption to complete
    await waitFor(() => {
      expect(result.current.sessions[0].notes).toBe('decrypted text');
    });
  });
});
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

import {
  createMockUser,
  createMockAuthStateChanged,
  createMockOnSnapshot,
  createMockGetDoc,
  createMockDocSnapshot,
  createMockQuerySnapshot,
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
import * as storage from '../lib/firestore-mock';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { saveNextNoteVersion } from '../lib/note-versioning';
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
    mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
    mockAddDoc.mockResolvedValue({ id: 'new-session-id' });
    mockDoc.mockReturnValue({ path: 'sessions', id: 'session-1' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDoc.mockImplementation(createMockGetDoc({ notes: 'existing notes' }));
    mockGetDocs.mockResolvedValue(createMockQuerySnapshot([]));
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
      }, { timeout: 5000 });

      expect(result.current.sessions).toEqual([]);
    });

    it('fetches sessions for patient', async () => {
      const mockSessions = createMockQuerySnapshot([
        createMockDocSnapshot('1', { patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'completed', type: 'individual', notes: 'note 1' }),
        createMockDocSnapshot('2', { patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'scheduled', type: 'individual', notes: 'note 2' }),
      ]);

      mockOnSnapshot.mockImplementation(createMockOnSnapshot(mockSessions.docs));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.sessions).toHaveLength(2);
      expect(result.current.sessions[0].id).toBe('1');
      expect(result.current.sessions[1].id).toBe('2');
    });

    it('adds a new session', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

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
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.updateSession('session-1', { status: 'completed' });
      });

      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('cancels a session', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.cancelSession({ id: 'session-1', googleEventId: 'event-1' } as any);
      });

      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('deletes a session', async () => {
          mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

          const { result } = renderHook(() => useSessions('patient-1'));

          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: 5000 });

          await act(async () => {
            await result.current.deleteSession('session-1');
          });

          expect(firestore.deleteDoc).toHaveBeenCalled();
        });

  it('handles error in addSession', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockAddDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

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
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockUpdateDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await expect(
        act(async () => {
          await result.current.updateSession('session-1', { status: 'completed' });
        })
      ).rejects.toThrow('Network error');
    });

    it('handles error in deleteSession', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockDeleteDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await expect(
        act(async () => {
          await result.current.deleteSession('session-1');
        })
      ).rejects.toThrow('Network error');
    });

    it('cleans up listener on unmount', async () => {
      const unsubscribe = vi.fn();
          mockOnSnapshot.mockImplementation((q, callback) => {
            callback(createMockQuerySnapshot([]));
            return unsubscribe;
          });

          const { result, unmount } = renderHook(() => useSessions('patient-1'));

          await waitFor(() => {
            expect(result.current.loading).toBe(false);
            }, { timeout: 10000 });

          unmount();

          expect(unsubscribe).toHaveBeenCalled();
          }, 15000);

    it('decrypts notes when encryption is unlocked', async () => {
      const mockSessions = createMockQuerySnapshot([
        createMockDocSnapshot('1', { patientId: 'patient-1', psychologistId: 'test-uid-123', date: new Date(), status: 'completed', type: 'individual', notes: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) }),
      ]);

      mockOnSnapshot.mockImplementation(createMockOnSnapshot(mockSessions.docs));

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      // Wait for decryption to complete
      await waitFor(() => {
        expect(result.current.sessions[0].notes).toBe('decrypted text');
      }, { timeout: 5000 });
    });

    it('reports subscription errors and clears the loading state', async () => {
      const error = new Error('subscription failed');
      mockOnSnapshot.mockImplementation((_query, _onNext, onError) => {
        onError(error);
        return vi.fn();
      });

      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(handleFirestoreError).toHaveBeenCalledWith(error, OperationType.LIST, 'sessions');
    });

    it('encrypts notes before adding a session when encryption is unlocked', async () => {
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => result.current.addSession({
        date: new Date(),
        status: 'scheduled',
        type: 'individual',
        notes: 'clinical note',
      }));

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notes: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) }),
      );
    });

    it('saves an existing note version before updating notes', async () => {
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => result.current.updateSession('session-1', { notes: 'replacement note' }));

      expect(saveNextNoteVersion).toHaveBeenCalledWith('session-1', 'test-uid-123', 'existing notes');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notes: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) }),
      );
    });

    it('updates a linked Google Calendar event when the session date changes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      const successEvent = vi.fn();
      window.addEventListener('google-auth-success', successEvent);
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => result.current.updateSession('session-1', {
        date: new Date('2026-10-12T10:00:00.000Z'),
        googleEventId: 'event-1',
        type: 'individual',
      }));

      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events/event-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(successEvent).toHaveBeenCalledOnce();
      window.removeEventListener('google-auth-success', successEvent);
    });

    it('dispatches a calendar authorization error when cancellation is forbidden', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: { message: 'Calendar permission expired' } }),
      }));
      const authorizationError = vi.fn();
      window.addEventListener('google-auth-error', authorizationError);
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => result.current.cancelSession({
        id: 'session-1',
        googleEventId: 'event-1',
      } as any));

      expect(authorizationError).toHaveBeenCalledOnce();
      expect(authorizationError.mock.calls[0][0]).toMatchObject({
        detail: { status: 403, service: 'calendar', message: 'Calendar permission expired' },
      });
      window.removeEventListener('google-auth-error', authorizationError);
    });

    it('uploads attachment metadata and always resets the upload flag', async () => {
      const storageRef = { path: 'attachment-path' };
      vi.mocked(storage.getStorage).mockReturnValue({} as any);
      vi.mocked(storage.ref).mockReturnValue(storageRef as any);
      vi.mocked(storage.uploadBytes).mockResolvedValue({} as any);
      vi.mocked(storage.getDownloadURL).mockResolvedValue('https://drive.test/file');
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      let uploaded: Awaited<ReturnType<typeof result.current.uploadFile>> | undefined;
      await act(async () => {
        uploaded = await result.current.uploadFile(new File(['document'], 'report.pdf'), 'session-1');
      });

      expect(storage.uploadBytes).toHaveBeenCalledWith(storageRef, expect.any(File));
      expect(uploaded).toMatchObject({
        name: 'report.pdf',
        url: 'https://drive.test/file',
        size: 8,
        storagePath: expect.stringMatching(/^patients\/test-uid-123\/session-1\/\d+_report\.pdf$/),
      });
      expect(result.current.isUploading).toBe(false);
    });

    it('rejects oversized uploads before attempting storage access', async () => {
      const { result } = renderHook(() => useSessions('patient-1'));
      const oversizedFile = new File(['x'], 'large.pdf');
      Object.defineProperty(oversizedFile, 'size', { value: 40 * 1024 * 1024 + 1 });

      await expect(result.current.uploadFile(oversizedFile, 'session-1'))
        .rejects.toThrow('File size exceeds 40MB limit.');
      expect(storage.uploadBytes).not.toHaveBeenCalled();
    });

    it('swallows attachment deletion failures after logging them', async () => {
      vi.mocked(storage.deleteObject).mockRejectedValueOnce(new Error('delete failed'));
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useSessions('patient-1'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await expect(result.current.deleteFile('attachment-path')).resolves.toBeUndefined();

      expect(errorLog).toHaveBeenCalledWith('File deletion failed:', expect.any(Error));
    });
  });
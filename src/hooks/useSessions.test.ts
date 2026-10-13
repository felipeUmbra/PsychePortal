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

const mockGoogleAuthState = vi.hoisted(() => ({
  driveToken: 'mock-drive-token' as string | null,
  calendarToken: 'mock-calendar-token' as string | null,
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

import { handleFirestoreError, OperationType } from '../lib/error-handler';

const mockHandleFirestoreError = vi.mocked(handleFirestoreError);

vi.mock('../context/GoogleAuthContext', () => ({
  useGoogleAuth: () => mockGoogleAuthState,
}));

const mockEncryptionState = vi.hoisted(() => ({
  isUnlocked: true,
  encrypt: vi.fn(async (_text: string) => ({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' })),
  decrypt: vi.fn(async (_payload: any) => 'decrypted text'),
}));

vi.mock('./useEncryption', () => ({
  useEncryption: () => mockEncryptionState,
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
    mockGoogleAuthState.driveToken = 'mock-drive-token';
    mockGoogleAuthState.calendarToken = 'mock-calendar-token';
    mockEncryptionState.isUnlocked = true;
    mockEncryptionState.encrypt.mockImplementation(async () => ({
      version: 1,
      ciphertext: 'encrypted',
      iv: 'iv',
      salt: 'salt',
    }));
    mockEncryptionState.decrypt.mockImplementation(async () => 'decrypted text');
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

        // Mock window.dispatchEvent
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    
        // Mock global.fetch
        global.fetch = vi.fn();
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

    it('does not sync an empty Drive token to the Firestore mock', () => {
      mockGoogleAuthState.driveToken = null;
      renderHook(() => useSessions('patient-1'));

      expect(storage.setDriveToken).not.toHaveBeenCalled();
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

    it('keeps plaintext and empty notes unchanged when encryption is locked', async () => {
      mockEncryptionState.isUnlocked = false;
      const docs = createMockQuerySnapshot([
        createMockDocSnapshot('plain', { notes: 'legacy plaintext' }),
        createMockDocSnapshot('empty', { notes: '' }),
        createMockDocSnapshot('missing', {}),
      ]);
      mockOnSnapshot.mockImplementation(createMockOnSnapshot(docs.docs));

      const { result } = renderHook(() => useSessions('patient-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessions.map((session) => session.notes)).toEqual([
        'legacy plaintext',
        '',
        undefined,
      ]);
      expect(mockEncryptionState.decrypt).not.toHaveBeenCalled();
    });

    it('keeps malformed and undecryptable notes safe during snapshot loading', async () => {
      mockEncryptionState.decrypt.mockRejectedValueOnce(new Error('decrypt failed'));
      const docs = createMockQuerySnapshot([
        createMockDocSnapshot('malformed', { notes: '{not json' }),
        createMockDocSnapshot('encrypted', {
          notes: JSON.stringify({ version: 1, ciphertext: 'encrypted' }),
        }),
        createMockDocSnapshot('incomplete', {
          notes: JSON.stringify({ version: 1, ciphertext: '' }),
        }),
      ]);
      mockOnSnapshot.mockImplementation(createMockOnSnapshot(docs.docs));

      const { result } = renderHook(() => useSessions('patient-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessions.map((session) => session.notes)).toEqual([
        '{not json',
        '',
        JSON.stringify({ version: 1, ciphertext: '' }),
      ]);
    });

    it('does not apply a pending decryption to a session removed by a later snapshot', async () => {
      let resolveDecryption!: (value: string) => void;
      mockEncryptionState.decrypt.mockImplementationOnce(
        () => new Promise((resolve) => { resolveDecryption = resolve; }),
      );
      let onSnapshot: ((snapshot: ReturnType<typeof createMockQuerySnapshot>) => void) | undefined;
      mockOnSnapshot.mockImplementation((_query, callback) => {
        onSnapshot = callback;
        return vi.fn();
      });
      const { result } = renderHook(() => useSessions('patient-1'));
      const encryptedSnapshot = createMockQuerySnapshot([
        createMockDocSnapshot('removed-session', {
          notes: JSON.stringify({ version: 1, ciphertext: 'encrypted' }),
        }),
      ]);
      act(() => onSnapshot?.(encryptedSnapshot));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => onSnapshot?.(createMockQuerySnapshot([
        createMockDocSnapshot('other-session', { notes: 'unrelated note' }),
      ])));
      await act(async () => resolveDecryption('late decrypted note'));

      expect(result.current.sessions).toEqual([
        expect.objectContaining({ id: 'other-session', notes: 'unrelated note' }),
      ]);
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
            expect(mockHandleFirestoreError).toHaveBeenCalledWith(error, OperationType.LIST, 'sessions');
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

    it('writes plaintext notes when encryption is locked and skips empty notes', async () => {
      mockEncryptionState.isUnlocked = false;
      const { result } = renderHook(() => useSessions('patient-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => result.current.addSession({
        date: new Date(),
        status: 'scheduled',
        type: 'individual',
        notes: 'legacy plaintext',
      }));
      await act(async () => result.current.addSession({
        date: new Date(),
        status: 'scheduled',
        type: 'individual',
        notes: '',
      }));

      expect(mockEncryptionState.encrypt).not.toHaveBeenCalled();
      expect(mockAddDoc).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ notes: 'legacy plaintext' }),
      );
      expect(mockAddDoc).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ notes: '' }),
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

        it('handles addSession when user is null', async () => {
          vi.mocked(useAuthState).mockReturnValue([null, false]);
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await expect(act(async () => result.current.addSession({ date: new Date().toISOString(), type: 'individual' }))).rejects.toThrow('Unauthenticated or missing patient ID');
        });

        it('handles addSession when patientId is missing', async () => {
          const { result } = renderHook(() => useSessions(''));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await expect(act(async () => result.current.addSession({ date: new Date().toISOString(), type: 'individual' }))).rejects.toThrow('Unauthenticated or missing patient ID');
        });

        it('handles updateSession when user is null', async () => {
          vi.mocked(useAuthState).mockReturnValue([null, false]);
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await expect(act(async () => result.current.updateSession('session-1', { type: 'individual' }))).rejects.toThrow('Unauthenticated');
        });

        it('rejects attachment and session operations without a user', async () => {
          vi.mocked(useAuthState).mockReturnValue([null, false]);
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await expect(result.current.uploadFile(new File(['x'], 'file.txt'), 'session-1'))
            .rejects.toThrow('Unauthenticated');
          await expect(result.current.deleteFile('attachment-path'))
            .rejects.toThrow('Unauthenticated');
          await expect(result.current.deleteSession('session-1'))
            .rejects.toThrow('Unauthenticated');
        });

        it('handles updateSession with encrypted notes when unlocked', async () => {
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', { notes: 'old notes', googleEventId: 'evt-1' }));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.updateSession('session-1', { notes: 'new encrypted notes' }));
          expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('skips note versioning when the stored note is null or absent', async () => {
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', { notes: null }));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.updateSession('session-1', { notes: 'new note' }));

          expect(saveNextNoteVersion).not.toHaveBeenCalled();
          expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('continues updating if fetching the current note for versioning fails', async () => {
          mockGetDoc.mockRejectedValueOnce(new Error('read failed'));
          vi.spyOn(console, 'error').mockImplementation(() => {});
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.updateSession('session-1', { notes: 'new note' }));

          expect(saveNextNoteVersion).not.toHaveBeenCalled();
          expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('writes plaintext updates when encryption is locked and notes are empty', async () => {
          mockEncryptionState.isUnlocked = false;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.updateSession('session-1', { notes: '' }));

          expect(mockEncryptionState.encrypt).not.toHaveBeenCalled();
          expect(mockUpdateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ notes: '' }),
          );
        });

        it('handles cancelSession without googleEventId', async () => {
          const session = { id: 'session-1', status: 'scheduled' };
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', session));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.cancelSession(session));
          expect(global.fetch).not.toHaveBeenCalled();
        });

        it('handles calendar deletion authorization failures with server messages', async () => {
          const session = { id: 'session-1', status: 'scheduled', googleEventId: 'event-1' };
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: { message: 'Token expired' } }),
          }) as unknown as typeof fetch;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.cancelSession(session as any));

          expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'google-auth-error',
              detail: expect.objectContaining({ status: 401, message: 'Token expired' }),
            }),
          );
        });

        it('updates linked calendar events using the session type fallback', async () => {
          const snapshot = createMockQuerySnapshot([
            createMockDocSnapshot('session-1', {
              googleEventId: 'event-update',
              type: 'group',
            }),
          ]);
          mockOnSnapshot.mockImplementation(createMockOnSnapshot(snapshot.docs));
          global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.updateSession('session-1', {
            date: new Date('2024-01-02T10:00:00.000Z'),
            type: '',
          }));

          expect(global.fetch).toHaveBeenCalledWith(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events/event-update',
            expect.objectContaining({
              method: 'PATCH',
              body: expect.stringContaining('"summary":"layout.workspace: group"'),
            }),
          );
          expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'google-auth-success' }),
          );

          await act(async () => result.current.updateSession('session-1', {
            googleEventId: 'event-explicit-type',
            date: new Date('2024-01-02T10:00:00.000Z'),
            type: 'individual',
          }));
          await act(async () => result.current.updateSession('other-session', {
            googleEventId: 'event-no-type',
            date: new Date('2024-01-02T10:00:00.000Z'),
          }));
          expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            expect.any(String),
            expect.objectContaining({ body: expect.stringContaining('"summary":"layout.workspace: individual"') }),
          );
          expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            expect.any(String),
            expect.objectContaining({ body: expect.stringContaining('"summary":"layout.workspace: "') }),
          );
        });

        it('skips calendar event updates when the calendar token is absent', async () => {
          mockGoogleAuthState.calendarToken = null;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.updateSession('session-1', {
            googleEventId: 'event-without-token',
            date: new Date(),
          }));

          expect(global.fetch).not.toHaveBeenCalled();
        });

        it('uses the calendar status text when the error response has no message', async () => {
          const session = { id: 'session-1', status: 'scheduled', googleEventId: 'event-2' };
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({}),
          }) as unknown as typeof fetch;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.cancelSession(session as any));

          expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'google-auth-error',
              detail: expect.objectContaining({ status: 403, message: 'Forbidden' }),
            }),
          );
        });

        it('ignores calendar deletion responses without an authorization error', async () => {
          const session = { id: 'session-1', status: 'scheduled', googleEventId: 'event-3' };
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Server Error',
          }) as unknown as typeof fetch;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.cancelSession(session as any));

          expect(window.dispatchEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'google-auth-success' }),
          );
          expect(window.dispatchEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'google-auth-error' }),
          );
        });

        it('dispatches calendar success after deleting an event and falls back when error JSON fails', async () => {
          const session = { id: 'session-1', status: 'scheduled', googleEventId: 'event-5' };
          const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, status: 204 })
            .mockResolvedValueOnce({
              ok: false,
              status: 401,
              statusText: 'Unauthorized',
              json: async () => { throw new Error('bad response body'); },
            });
          global.fetch = fetchMock as unknown as typeof fetch;
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.cancelSession(session as any));
          expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'google-auth-success' }),
          );

          await act(async () => result.current.cancelSession(session as any));
          expect(window.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'google-auth-error',
              detail: expect.objectContaining({ status: 401, message: 'Unauthorized' }),
            }),
          );
        });

        it('does not request calendar deletion when the calendar token is missing', async () => {
          mockGoogleAuthState.calendarToken = null;
          const session = { id: 'session-1', status: 'scheduled', googleEventId: 'event-4' };
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => result.current.cancelSession(session as any));

          expect(global.fetch).not.toHaveBeenCalled();
        });

        it('handles uploadFile size limit exceeded', async () => {
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          const largeFile = new File(['x'.repeat(50 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
          await expect(act(async () => result.current.uploadFile(largeFile, 'session-1'))).rejects.toThrow('File size exceeds 40MB limit.');
        });

        it('handles uploadFile success', async () => {
          const mockRef = { path: 'test/path' };
          vi.mocked(storage.ref).mockReturnValue(mockRef);
          vi.mocked(storage.uploadBytes).mockResolvedValue(undefined);
          vi.mocked(storage.getDownloadURL).mockResolvedValue('https://example.com/file.pdf');
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
          const uploadResult = await act(async () => result.current.uploadFile(file, 'session-1'));
          expect(uploadResult).toHaveProperty('name', 'test.pdf');
          expect(uploadResult).toHaveProperty('url', 'https://example.com/file.pdf');
        });

        it('handles uploadFile error', async () => {
          vi.mocked(storage.ref).mockReturnValue({ path: 'test/path' });
          vi.mocked(storage.uploadBytes).mockRejectedValue(new Error('Upload failed'));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
          await expect(act(async () => result.current.uploadFile(file, 'session-1'))).rejects.toThrow('Upload failed');
        });

        it('handles deleteFile success', async () => {
          vi.mocked(storage.deleteObject).mockResolvedValue(undefined);
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.deleteFile('patients/uid/session/file.pdf'));
          expect(storage.deleteObject).toHaveBeenCalledWith({ path: 'patients/uid/session/file.pdf' });
        });

        it('handles deleteFile error', async () => {
          vi.mocked(storage.deleteObject).mockRejectedValue(new Error('Delete failed'));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
                  // deleteFile swallows errors, so it resolves
                  await expect(act(async () => result.current.deleteFile('patients/uid/session/file.pdf'))).resolves.toBeUndefined();
                });

        it('handles note versioning on updateSession', async () => {
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', { notes: 'current notes', googleEventId: 'evt-1' }));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.updateSession('session-1', { notes: 'updated notes' }));
          expect(saveNextNoteVersion).toHaveBeenCalledWith('session-1', 'test-uid-123', 'current notes');
        });

        it('handles note versioning skip when notes unchanged', async () => {
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', { notes: 'same notes', googleEventId: 'evt-1' }));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.updateSession('session-1', { type: 'individual' }));
          expect(saveNextNoteVersion).not.toHaveBeenCalled();
        });

        it('handles note versioning error gracefully', async () => {
          mockGetDoc.mockResolvedValueOnce(createMockDocSnapshot('session-1', { notes: 'current notes', googleEventId: 'evt-1' }));
          vi.mocked(saveNextNoteVersion).mockRejectedValueOnce(new Error('Version save failed'));
          const { result } = renderHook(() => useSessions('patient-1'));
          await waitFor(() => expect(result.current.loading).toBe(false));
          await act(async () => result.current.updateSession('session-1', { notes: 'updated notes' }));
          expect(mockUpdateDoc).toHaveBeenCalled();
        });
      });
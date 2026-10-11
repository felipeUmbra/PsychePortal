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
  auth: {
    currentUser: createMockUser('test-uid-123'),
    onAuthStateChanged: createMockAuthStateChanged(createMockUser('test-uid-123')),
  },
  db: {},
}));

vi.mock('../lib/error-handler', () => ({
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'LIST', CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE', GET: 'GET' },
}));

vi.mock('./useEncryption', () => ({
  useEncryption: () => ({
    isUnlocked: true,
    encrypt: vi.fn(async (text: string) => ({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' })),
    decrypt: vi.fn(async (payload: any) => 'decrypted text'),
  }),
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
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

import { usePatients, usePatient } from './usePatients';
import { auth } from '../firebase';
import * as firestore from 'firebase/firestore';

describe('usePatients', () => {
  const mockUser = createMockUser('test-uid-123');
  const mockCollection = vi.fn();
  const mockQuery = vi.fn();
  const mockWhere = vi.fn();
  const mockOnSnapshot = vi.fn();
  const mockAddDoc = vi.fn();
  const mockDoc = vi.fn();
  const mockGetDoc = vi.fn();
  const mockUpdateDoc = vi.fn();
  const mockDeleteDoc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation(createMockAuthStateChanged(mockUser));

    vi.mocked(firestore.collection).mockImplementation(mockCollection);
    vi.mocked(firestore.query).mockImplementation(mockQuery);
    vi.mocked(firestore.where).mockImplementation(mockWhere);
    vi.mocked(firestore.onSnapshot).mockImplementation(mockOnSnapshot);
    vi.mocked(firestore.addDoc).mockImplementation(mockAddDoc);
    vi.mocked(firestore.doc).mockImplementation(mockDoc);
    vi.mocked(firestore.getDoc).mockImplementation(mockGetDoc);
    vi.mocked(firestore.updateDoc).mockImplementation(mockUpdateDoc);
    vi.mocked(firestore.deleteDoc).mockImplementation(mockDeleteDoc);

    // Default mock implementations
    mockCollection.mockReturnValue({ path: 'patients' });
    mockQuery.mockReturnValue({ path: 'patients', conditions: [] });
    mockWhere.mockReturnValue({ type: 'where' });
    mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
    mockAddDoc.mockResolvedValue({ id: 'new-patient-id' });
    mockDoc.mockReturnValue({ path: 'patients', id: 'patient-1' });
    mockGetDoc.mockImplementation(createMockGetDoc({ fullName: 'Test Patient' }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => usePatients());
    expect(result.current.loading).toBe(true);
  });

  it('sets loading to false when no user', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation(createMockAuthStateChanged(null));

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toEqual([]);
  });

  it('fetches patients for user', async () => {
    const mockPatients = [
      { id: '1', data: () => ({ psychologistId: 'test-uid-123', fullName: 'Patient 1', email: 'p1@test.com' }) },
      { id: '2', data: () => ({ psychologistId: 'test-uid-123', fullName: 'Patient 2', email: 'p2@test.com' }) },
    ];

    mockOnSnapshot.mockImplementation((q, callback) => {
      callback({ docs: mockPatients });
      return vi.fn();
    });

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toHaveLength(2);
    expect(result.current.patients[0].id).toBe('1');
    expect(result.current.patients[1].id).toBe('2');
  });

  it('adds a new patient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      const patientId = await act(async () => {
        return await result.current.addPatient({
          fullName: 'New Patient',
          email: 'new@test.com',
          phone: '123456789',
        });
      });

      expect(patientId).toBe('new-patient-id');
      expect(firestore.addDoc).toHaveBeenCalled();
    });

    it('updates a patient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.updatePatient('patient-1', { fullName: 'Updated Name' });
      });

      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('deletes a patient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.deletePatient('patient-1');
      });

      expect(firestore.deleteDoc).toHaveBeenCalled();
    });

    it('handles error in addPatient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockAddDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await expect(
        act(async () => {
          await result.current.addPatient({
            fullName: 'New Patient',
            email: 'new@test.com',
          });
        })
      ).rejects.toThrow('Network error');
    });

    it('handles error in updatePatient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockUpdateDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await expect(
        act(async () => {
          await result.current.updatePatient('patient-1', { fullName: 'Updated Name' });
        })
      ).rejects.toThrow('Network error');
    });

    it('handles error in deletePatient', async () => {
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
      mockDeleteDoc.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      await expect(
        act(async () => {
          await result.current.deletePatient('patient-1');
        })
      ).rejects.toThrow('Network error');
    });

    it('cleans up listener on unmount', async () => {
      const unsubscribe = vi.fn();
          mockOnSnapshot.mockImplementation((q, callback) => {
            callback(createMockQuerySnapshot([]));
            return unsubscribe;
          });

          const { result, unmount } = renderHook(() => usePatients());

          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: 5000 });

          unmount();

          expect(unsubscribe).toHaveBeenCalled();
        });

    it('decrypts notes when encryption is unlocked', async () => {
      const mockPatients = createMockQuerySnapshot([
        createMockDocSnapshot('1', { psychologistId: 'test-uid-123', fullName: 'Patient 1', notes: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) }),
      ]);

      mockOnSnapshot.mockImplementation(createMockOnSnapshot(mockPatients.docs));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      // Wait for decryption to complete
      await waitFor(() => {
        expect(result.current.patients[0].notes).toBe('decrypted text');
      }, { timeout: 5000 });
    });

    it('decrypts anamnesis fields when encryption is unlocked', async () => {
      const mockPatients = createMockQuerySnapshot([
        createMockDocSnapshot('1', { psychologistId: 'test-uid-123', fullName: 'Patient 1', anamnesis: { chiefComplaint: JSON.stringify({ version: 1, ciphertext: 'encrypted', iv: 'iv', salt: 'salt' }) } }),
      ]);

      mockOnSnapshot.mockImplementation(createMockOnSnapshot(mockPatients.docs));

      const { result } = renderHook(() => usePatients());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 5000 });

      // Wait for decryption to complete
      await waitFor(() => {
        expect(result.current.patients[0].anamnesis?.chiefComplaint).toBe('decrypted text');
      }, { timeout: 5000 });
    });
  });

describe('usePatient', () => {
  const mockUser = createMockUser('test-uid-123');
  const mockDoc = vi.fn();
  const mockGetDoc = vi.fn();
  const mockUpdateDoc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation(createMockAuthStateChanged(mockUser));

    vi.mocked(firestore.doc).mockImplementation(mockDoc);
    vi.mocked(firestore.getDoc).mockImplementation(mockGetDoc);
    vi.mocked(firestore.updateDoc).mockImplementation(mockUpdateDoc);

    // Default mock implementations
    mockDoc.mockReturnValue({ path: 'patients', id: 'patient-1' });
    mockGetDoc.mockImplementation(createMockGetDoc({ fullName: 'Test Patient', email: 'test@test.com' }));
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => usePatient('patient-1'));
    expect(result.current.loading).toBe(true);
  });

  it('sets loading to false when no user', async () => {
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      writable: true,
      configurable: true,
    });
    const mockAuthChanged = vi.mocked(auth.onAuthStateChanged);
    mockAuthChanged.mockImplementation(createMockAuthStateChanged(null));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.patient).toBeNull();
  });

  it('sets loading to false when no patient id', async () => {
    const { result } = renderHook(() => usePatient(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.patient).toBeNull();
  });

  it('fetches patient by id', async () => {
      mockGetDoc.mockImplementation(createMockGetDoc({ fullName: 'Test Patient', email: 'test@test.com' }, true, 'patient-1'));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.patient).toEqual({ id: 'patient-1', fullName: 'Test Patient', email: 'test@test.com' });
  });

  it('retries fetching patient up to 5 times', async () => {
    mockGetDoc
      .mockImplementationOnce(createMockGetDoc(null, false))
      .mockImplementationOnce(createMockGetDoc(null, false))
        .mockImplementationOnce(createMockGetDoc({ fullName: 'Test Patient' }, true, 'patient-1'));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(mockGetDoc).toHaveBeenCalledTimes(3);
    expect(result.current.patient).toEqual({ id: 'patient-1', fullName: 'Test Patient' });
  });

  it('handles patient not found after retries', async () => {
    mockGetDoc.mockImplementation(createMockGetDoc(null, false));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.patient).toBeNull();
    expect(mockGetDoc).toHaveBeenCalledTimes(5);
  });

  it('updates patient', async () => {
    mockGetDoc.mockImplementation(createMockGetDoc({ fullName: 'Test Patient' }));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    await act(async () => {
      await result.current.updatePatient({ fullName: 'Updated Name' });
    });

    expect(firestore.updateDoc).toHaveBeenCalled();
    expect(result.current.patient?.fullName).toBe('Updated Name');
  });

  it('handles error in updatePatient', async () => {
    mockGetDoc.mockImplementation(createMockGetDoc({ fullName: 'Test Patient' }));
    mockUpdateDoc.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePatient('patient-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    await expect(
      act(async () => {
        await result.current.updatePatient({ fullName: 'Updated Name' });
      })
    ).rejects.toThrow('Network error');
  });
});
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { cleanAllCollections, makeDelegates } from '../test/firestore-mock-bootstrap';
import type { EncryptedPayload } from '../lib/note-crypto';

// --- Mock firebase/firestore ---
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
  auth: { currentUser: { uid: 'enc-user', email: 'enc@test.com' } },
}));

// --- Mock react-firebase-hooks/auth ---
const MOCK_USER = { uid: 'enc-user', email: 'enc@test.com' };
const mockUseAuthState = vi.hoisted(() => vi.fn(() => [MOCK_USER, false]));
vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: mockUseAuthState,
}));

// --- Mock useEncryption (control isUnlocked/encrypt/decrypt) ---
const mockEncrypt = vi.fn(async (text: string) => ({
  ciphertext: btoa(text),
  iv: btoa('fake-iv'),
  version: 'test',
} as EncryptedPayload));
const mockDecrypt = vi.fn(async (p: EncryptedPayload) => atob(p.ciphertext));
const mockIsUnlocked = vi.hoisted(() => ({ value: false }));
vi.mock('./useEncryption', () => ({
  useEncryption: () => ({
    isUnlocked: mockIsUnlocked.value,
    isSetup: true,
    isLoading: false,
    needsSetup: false,
    setup: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    disable: vi.fn(),
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
    encryptFields: vi.fn(),
    decryptFields: vi.fn(),
  }),
}));

import * as firestoreMock from '../lib/firestore-mock';
import { usePatients } from './usePatients';

const PSYCH = 'enc-user';

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
  mockIsUnlocked.value = false;
  mockEncrypt.mockClear();
  mockDecrypt.mockClear();
  await boot();
  await cleanAllCollections(firestoreMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePatients', () => {
  const PATIENT_DATA = {
    name: 'Ana Teste',
    email: 'ana@test.com',
    phone: '11999990000',
    dateOfBirth: '1990-01-15',
    gender: 'F',
  };

  it('starts with loading true and empty patients', () => {
    const { result } = renderHook(() => usePatients());
    expect(result.current.loading).toBe(true);
    expect(result.current.patients).toEqual([]);
  });

  it('loads patients for the authenticated psychologist', async () => {
    await firestoreMock.setDoc(
      firestoreMock.doc({}, 'patients', 'p-enc-1'),
      { id: 'p-enc-1', name: 'Patient A', psychologistId: PSYCH, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    );

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.patients[0].name).toBe('Patient A');
  });

  it('writes plaintext when vault is locked (isUnlocked=false)', async () => {
    mockIsUnlocked.value = false;

    const { result } = renderHook(() => usePatients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let patientId: string | undefined;
    await act(async () => {
      patientId = await result.current.addPatient(PATIENT_DATA as any);
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    const snap = await firestoreMock.getDocs(firestoreMock.collection({}, 'patients'));
    expect(snap.docs).toHaveLength(1);
    expect(snap.docs[0].data().name).toBe('Ana Teste');
    // notes should be absent (not encrypted)
    expect(snap.docs[0].data().notes).toBeUndefined();
  });

  it('encrypts notes before writing when vault is unlocked', async () => {
    mockIsUnlocked.value = true;

    const { result } = renderHook(() => usePatients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addPatient({
        ...PATIENT_DATA,
        notes: 'Clinical note content',
      } as any);
    });

    // encrypt must have been called for the notes field
    expect(mockEncrypt).toHaveBeenCalledWith('Clinical note content');

    // The stored document should have notes as JSON-serialized EncryptedPayload
    const snap = await firestoreMock.getDocs(firestoreMock.collection({}, 'patients'));
    expect(snap.docs).toHaveLength(1);
    const storedNotes = JSON.parse(snap.docs[0].data().notes);
    expect(storedNotes.ciphertext).toBeTruthy();
    expect(storedNotes.iv).toBeTruthy();
    expect(storedNotes.version).toBe('test');
  });

  it('encrypts anamnesis sub-fields when vault is unlocked', async () => {
    mockIsUnlocked.value = true;

    const { result } = renderHook(() => usePatients());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addPatient({
        ...PATIENT_DATA,
        anamnesis: {
          chiefComplaint: 'anxiety attacks',
          medicalHistory: 'no prior conditions',
          psychiatricHistory: '',
          familyHistory: '',
          medications: '',
        },
      } as any);
    });

    // chiefComplaint and medicalHistory should each have been encrypted
    expect(mockEncrypt).toHaveBeenCalledWith('anxiety attacks');
    expect(mockEncrypt).toHaveBeenCalledWith('no prior conditions');

    const snap = await firestoreMock.getDocs(firestoreMock.collection({}, 'patients'));
    const anamnesis = snap.docs[0].data().anamnesis;
    const ccPayload = JSON.parse(anamnesis.chiefComplaint);
    expect(ccPayload.ciphertext).toBeTruthy();
  });

  it('updatePatient encrypts notes when vault is unlocked', async () => {
    // Seed a patient first
    await firestoreMock.setDoc(
      firestoreMock.doc({}, 'patients', 'p-upd'),
      { id: 'p-upd', name: 'Updatable', psychologistId: PSYCH, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    );
    mockIsUnlocked.value = false;

    const { result, rerender } = renderHook(() => usePatients());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.patients.some(p => p.id === 'p-upd')).toBe(true);
    });

    // Switch the vault to unlocked and re-render so the hook picks it up
    mockIsUnlocked.value = true;
    mockEncrypt.mockClear();
    rerender();

    await act(async () => {
      await result.current.updatePatient('p-upd', { notes: 'updated note' } as any);
    });

    expect(mockEncrypt).toHaveBeenCalledWith('updated note');
  });

  it('returns empty when user is null', async () => {
    mockUseAuthState.mockReturnValue([null, false]);

    const { result } = renderHook(() => usePatients());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.patients).toEqual([]);
  });

  it('deletePatient removes the document', async () => {
    await firestoreMock.setDoc(
      firestoreMock.doc({}, 'patients', 'p-del'),
      { id: 'p-del', name: 'To Delete', psychologistId: PSYCH, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    );

    const { result } = renderHook(() => usePatients());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.patients.some(p => p.id === 'p-del')).toBe(true);
    });

    await act(async () => {
      await result.current.deletePatient('p-del');
    });

    // The document should be gone from the store
    const snap = await firestoreMock.getDoc(firestoreMock.doc({}, 'patients', 'p-del'));
    expect(snap.exists()).toBe(false);
  });
});

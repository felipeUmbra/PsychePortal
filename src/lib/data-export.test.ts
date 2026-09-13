// Runs in NODE env because jsdom's crypto shim breaks PBKDF2/AES-GCM
// (Cipher job failed). Node has real WebCrypto. fake-indexeddb is assigned
// manually (NOT /auto, which also patches WebCrypto globals conflict-prone).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
(globalThis as any).indexedDB = fakeIndexedDB;

import { cleanAllCollections, makeDelegates } from '../test/firestore-mock-bootstrap';

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
  auth: { currentUser: undefined },
}));
const mockAudit = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock('./audit', () => ({
  logEvent: mockAudit.logEvent,
}));

import * as firestoreMock from './firestore-mock';
import { generateDataBundle } from './data-export';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  encryptNote,
  storeKeyRecord,
  deleteKeyRecord,
} from './note-crypto';

const PSYCH = 'psych-export';
const PATIENT = 'patient-export';

async function boot() {
  mockFstore.delegates = makeDelegates(firestoreMock);
  mockDb.value = firestoreMock.getFirestore();
  firestoreMock.setDriveToken('test-token');
  await new Promise((r) => setTimeout(r, 15));
}

async function seedPatient() {
  await firestoreMock.setDoc(firestoreMock.doc({}, 'patients', PATIENT), {
    id: PATIENT, name: 'Ana DSR', psychologistId: PSYCH,
  });
}

async function seedSession(overrides: Record<string, unknown> = {}) {
  await firestoreMock.addDoc(firestoreMock.collection({}, 'sessions'), {
    psychologistId: PSYCH,
    patientId: PATIENT,
    date: new Date().toISOString(),
    ...overrides,
  });
}

async function seedConsent() {
  await firestoreMock.addDoc(firestoreMock.collection({}, 'patient_consents'), {
    patientId: PATIENT, psychologistId: PSYCH,
  });
}

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
  mockAudit.logEvent.mockClear();
  await boot();
  await cleanAllCollections(firestoreMock);
  await deleteKeyRecord(PSYCH).catch(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateDataBundle', () => {
  it('produces the full bundle shape with patient, sessions and integrity', async () => {
    await seedPatient();
    await seedSession({ notes: 'plaintext note' });
    await seedConsent();

    const bundle = await generateDataBundle(PATIENT, PSYCH);

    expect(bundle.metadata.patientId).toBe(PATIENT);
    expect(bundle.metadata.exportedBy).toBe(PSYCH);
    expect(bundle.patient).toMatchObject({ id: PATIENT, name: 'Ana DSR' });
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.integrity.algorithm).toBeTruthy();
    expect(bundle.integrity.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns patient null when the patient doc is missing', async () => {
    await seedSession({ patientId: PATIENT });
    const bundle = await generateDataBundle('ghost-patient', PSYCH);
    expect(bundle.patient).toBeNull();
  });

  it('keeps plaintext notes as-is', async () => {
    await seedPatient();
    await seedSession({ notes: 'super-secret-clinical-note' });
    const bundle = await generateDataBundle(PATIENT, PSYCH);
    expect((bundle.sessions[0] as any).notes).toBe('super-secret-clinical-note');
    // tryDecryptNote on plaintext returns {plaintext: null, encrypted: false}
    // → export sets _notesDecrypted = false, _notesEncrypted not set
    expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
  });

  it('marks encrypted notes without passphrase as encrypted (not decrypted)', async () => {
    await seedPatient();
    const salt = generateSalt();
    const key = await deriveKeyFromPassphrase('pass', salt);
    const encrypted = await encryptNote('confidential', key);
    await seedSession({ notes: encrypted });

    const bundle = await generateDataBundle(PATIENT, PSYCH);

    expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
    expect((bundle.sessions[0] as any)._notesEncrypted).toBe(true);
  });

  it('decrypts notes when the correct passphrase + key record are provided', async () => {
    await seedPatient();
    const salt = generateSalt();
    const key = await deriveKeyFromPassphrase('the-passphrase', salt);
    const encrypted = await encryptNote('decrypted-in-export', key);
    await seedSession({ notes: encrypted });
    await storeKeyRecord(PSYCH, salt, 'a'.repeat(64));

    const bundle = await generateDataBundle(PATIENT, PSYCH, 'the-passphrase');

    expect((bundle.sessions[0] as any).notes).toBe('decrypted-in-export');
    expect((bundle.sessions[0] as any)._notesDecrypted).toBe(true);
    expect((bundle.sessions[0] as any)._notesEncrypted).toBeUndefined();
  });

  it('stays encrypted when the wrong passphrase is provided', async () => {
    await seedPatient();
    const salt = generateSalt();
    const key = await deriveKeyFromPassphrase('right-pass', salt);
    const encrypted = await encryptNote('top-secret', key);
    await seedSession({ notes: encrypted });
    await storeKeyRecord(PSYCH, salt, 'a'.repeat(64));

    const bundle = await generateDataBundle(PATIENT, PSYCH, 'wrong-pass');

    expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
    expect((bundle.sessions[0] as any)._notesEncrypted).toBe(true);
  });

  it('logs an export event to the audit trail', async () => {
    await seedPatient();
    await generateDataBundle(PATIENT, PSYCH);
    expect(mockAudit.logEvent).toHaveBeenCalled();
  });
});
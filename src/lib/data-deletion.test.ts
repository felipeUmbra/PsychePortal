// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
const mockAudit = vi.hoisted(() => ({ logDelete: vi.fn() }));
vi.mock('./audit', () => ({
  logDelete: mockAudit.logDelete,
}));
const mockDeleteObject = vi.hoisted(() => ({ fn: vi.fn() }));

// data-deletion imports { deleteObject } from './firestore-mock'.
// Spy on the REAL deleteObject so the mock module stays intact.
import * as firestoreMock from './firestore-mock';
const realDeleteObject = firestoreMock.deleteObject;

import { deleteAllPatientData } from './data-deletion';

const PSYCH = 'psych-del';
const PATIENT_ID = 'patient-42';

async function boot() {
  mockFstore.delegates = makeDelegates(firestoreMock);
  mockDb.value = firestoreMock.getFirestore();
  firestoreMock.setDriveToken('test-token');
  await new Promise((r) => setTimeout(r, 15));
}

async function seedPatient() {
  await firestoreMock.setDoc(firestoreMock.doc({}, 'patients', PATIENT_ID), {
    id: PATIENT_ID,
    name: 'Ana Erased',
    psychologistId: PSYCH,
  });
}

async function seedSession(overrides: Record<string, unknown> = {}) {
  return (await firestoreMock.addDoc(firestoreMock.collection({}, 'sessions'), {
    psychologistId: PSYCH,
    patientId: PATIENT_ID,
    date: new Date().toISOString(),
    ...overrides,
  })).id;
}

async function seedConsent() {
  await firestoreMock.addDoc(firestoreMock.collection({}, 'patient_consents'), {
    patientId: PATIENT_ID,
    psychologistId: PSYCH,
  });
}

async function seedNoteVersion(sessionId: string) {
  await firestoreMock.addDoc(firestoreMock.collection({}, 'note_versions'), {
    sessionId,
    psychologistId: PSYCH,
    version: 1,
  });
}

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
  mockAudit.logDelete.mockClear();
  mockDeleteObject.fn.mockClear();
  mockDeleteObject.fn.mockResolvedValue(undefined);
  await boot();
  await cleanAllCollections(firestoreMock);
  // Replace the module-level deleteObject with the spy only while this test runs
  vi.spyOn(firestoreMock, 'deleteObject').mockImplementation(mockDeleteObject.fn);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deleteAllPatientData (LGPD erasure)', () => {
  it('deletes patient, sessions, consents and returns counts', async () => {
    await seedPatient();
    await seedSession();
    await seedConsent();
    const s2 = await seedSession();
    await seedNoteVersion(s2);

    const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(result.patientDeleted).toBe(true);
    expect(result.sessionsDeleted).toBe(2);
    expect(result.consentsDeleted).toBe(1);
    expect(result.attachmentsDeleted).toBe(0);

    const patients = (await firestoreMock.getDocs(firestoreMock.collection({}, 'patients'))).docs;
    const sessions = (await firestoreMock.getDocs(firestoreMock.collection({}, 'sessions'))).docs;
    const consents = (await firestoreMock.getDocs(firestoreMock.collection({}, 'patient_consents'))).docs;
    const versions = (await firestoreMock.getDocs(firestoreMock.collection({}, 'note_versions'))).docs;
    expect(patients).toHaveLength(0);
    expect(sessions).toHaveLength(0);
    expect(consents).toHaveLength(0);
    expect(versions).toHaveLength(0);
  });

  it('deletes Drive attachments via deleteObject using stored storagePath', async () => {
    await seedPatient();
    await seedSession({ attachments: [{ name: 'doc.pdf', storagePath: 'patients/p/s/doc.pdf' }] });

    const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(result.attachmentsDeleted).toBe(1);
    expect(mockDeleteObject.fn).toHaveBeenCalledWith({ path: 'patients/p/s/doc.pdf' });
  });

  it('reconstructs a legacy attachment path when storagePath is missing', async () => {
    await seedPatient();
    const sessionId = await seedSession({ attachments: [{ name: 'legacy.png' }] });

    const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(result.attachmentsDeleted).toBe(1);
    expect(mockDeleteObject.fn).toHaveBeenCalledWith({
      path: `patients/${PSYCH}/${sessionId}/legacy.png`,
    });
  });

  it('logs a bulk attachment deletion to the audit trail', async () => {
    await seedPatient();
    await seedSession({ attachments: [{ name: 'a.pdf', storagePath: 'x/a.pdf' }] });

    await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(mockAudit.logDelete).toHaveBeenCalledWith(
      PSYCH,
      'attachment',
      PATIENT_ID,
      expect.objectContaining({ count: 1, context: 'erasure_request' })
    );
  });

  it('removes draft_edit_ localStorage keys tied to the patient sessions', async () => {
    await seedPatient();
    const s1 = await seedSession();
    await seedSession();
    localStorage.setItem('draft_edit_' + s1, '{json}');
    localStorage.setItem('draft_edit_unknown-session', '{json}');
    localStorage.setItem('unrelated', 'x');

    await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(localStorage.getItem('draft_edit_' + s1)).toBeNull();
    expect(localStorage.getItem('draft_edit_unknown-session')).toBe('{json}');
    expect(localStorage.getItem('unrelated')).toBe('x');
  });

  it('returns zeros when the patient has no data', async () => {
    // Explicit re-clean to ensure isolation from any prior test residue
    await cleanAllCollections(firestoreMock);
    const result = await deleteAllPatientData('nonexistent-' + Date.now(), PSYCH);
    expect(result).toMatchObject({
      patientDeleted: false,
      sessionsDeleted: 0,
      consentsDeleted: 0,
      attachmentsDeleted: 0,
    });
  });
});
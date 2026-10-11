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
  // Mock the deleteObject export
  vi.spyOn(firestoreMock, 'deleteObject').mockImplementation(mockDeleteObject.fn);
  await boot();
  await cleanAllCollections(firestoreMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deleteAllPatientData (LGPD erasure)', () => {
  it('deletes patient, sessions and returns counts', async () => {
    await seedPatient();
    await seedSession();
    const s2 = await seedSession();
    await seedNoteVersion(s2);

    const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(result.patientDeleted).toBe(true);
    expect(result.sessionsDeleted).toBe(2);
    expect(result.attachmentsDeleted).toBe(0);

    const patients = (await firestoreMock.getDocs(firestoreMock.collection({}, 'patients'))).docs;
    const sessions = (await firestoreMock.getDocs(firestoreMock.collection({}, 'sessions'))).docs;
    const versions = (await firestoreMock.getDocs(firestoreMock.collection({}, 'note_versions'))).docs;
    expect(patients).toHaveLength(0);
    expect(sessions).toHaveLength(0);
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
      attachmentsDeleted: 0,
    });
  });

  it('handles audit log failure gracefully', async () => {
        await seedPatient();
        await seedSession({ attachments: [{ name: 'a.pdf', storagePath: 'x/a.pdf' }] });
        mockAudit.logDelete.mockRejectedValueOnce(new Error('Audit failed'));

        // The function doesn't catch logDelete errors, so it will throw
        await expect(deleteAllPatientData(PATIENT_ID, PSYCH)).rejects.toThrow('Audit failed');
      });

  it('handles Drive attachment deletion failure gracefully', async () => {
    await seedPatient();
    await seedSession({ attachments: [{ name: 'a.pdf', storagePath: 'x/a.pdf' }] });
    mockDeleteObject.fn.mockRejectedValueOnce(new Error('Drive delete failed'));

    const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

    expect(result.patientDeleted).toBe(true);
    expect(result.sessionsDeleted).toBe(1);
    expect(result.attachmentsDeleted).toBe(0); // Failed to delete
  });

  it('handles Firestore delete failure gracefully', async () => {
        await seedPatient();
        await seedSession();
        // Mock deleteDoc to fail for sessions only (patient deletion succeeds)
        const originalDeleteDoc = mockFstore.delegates.deleteDoc;
        let callCount = 0;
        mockFstore.delegates.deleteDoc = vi.fn().mockImplementation(async (...args) => {
          callCount++;
          // First call is for patient, let it succeed
          if (callCount === 1) {
            return originalDeleteDoc(...args);
          }
          // Subsequent calls are for sessions, make them fail
          throw new Error('Firestore delete failed');
        });

        // The function catches errors from session deleteDoc and continues
        const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

        expect(result.patientDeleted).toBe(true);
        expect(result.sessionsDeleted).toBe(0);
        expect(result.attachmentsDeleted).toBe(0);

        // Restore
        mockFstore.delegates.deleteDoc = originalDeleteDoc;
      });

  it('handles missing patient gracefully', async () => {
    const result = await deleteAllPatientData('nonexistent-patient', PSYCH);
    expect(result).toMatchObject({
      patientDeleted: false,
      sessionsDeleted: 0,
      attachmentsDeleted: 0,
      });
    });

    it('handles empty sessions array', async () => {
      await seedPatient();
      const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
      expect(result.sessionsDeleted).toBe(0);
      expect(result.patientDeleted).toBe(true);
    });

    it('handles sessions without attachments', async () => {
          await seedPatient();
          await seedSession();
          await seedSession();
          const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
          expect(result.sessionsDeleted).toBe(2);
          expect(result.attachmentsDeleted).toBe(0);
        });

        it('deletes note_versions for erased sessions', async () => {
          await seedPatient();
          const s1 = await seedSession();
          const s2 = await seedSession();
          await seedNoteVersion(s1);
          await seedNoteVersion(s2);

          const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

          expect(result.sessionsDeleted).toBe(2);
          const versions = (await firestoreMock.getDocs(firestoreMock.collection({}, 'note_versions'))).docs;
          expect(versions).toHaveLength(0);
        });

        it('handles legacy attachment path reconstruction', async () => {
          await seedPatient();
          const sessionId = await seedSession({ attachments: [{ name: 'legacy.pdf' }] });

          const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

          expect(result.attachmentsDeleted).toBe(1);
          expect(mockDeleteObject.fn).toHaveBeenCalledWith({
            path: `patients/${PSYCH}/${sessionId}/legacy.pdf`,
          });
        });

        it('handles Drive attachment deletion with stored storagePath', async () => {
          await seedPatient();
          await seedSession({ attachments: [{ name: 'doc.pdf', storagePath: 'patients/p/s/doc.pdf' }] });

          const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

          expect(result.attachmentsDeleted).toBe(1);
          expect(mockDeleteObject.fn).toHaveBeenCalledWith({ path: 'patients/p/s/doc.pdf' });
        });

        it('handles multiple attachments across sessions', async () => {
          await seedPatient();
          await seedSession({ attachments: [{ name: 'a.pdf', storagePath: 'x/a.pdf' }] });
          await seedSession({ attachments: [{ name: 'b.pdf', storagePath: 'y/b.pdf' }] });

          const result = await deleteAllPatientData(PATIENT_ID, PSYCH);

          expect(result.attachmentsDeleted).toBe(2);
          expect(mockDeleteObject.fn).toHaveBeenCalledTimes(2);
        });

        it('logs bulk attachment deletion to audit trail', async () => {
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

        it('removes draft_edit_ localStorage keys tied to patient sessions', async () => {
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

        it('handles legacy mock_db_cache cleanup', async () => {
          await seedPatient();
          const s1 = await seedSession();
          const legacyCache = {
            patients: [{ id: PATIENT_ID, name: 'Test' }],
            sessions: [{ id: s1, patientId: PATIENT_ID }, { id: 'other-session', patientId: 'other' }],
            note_versions: [{ sessionId: s1 }, { sessionId: 'other-session' }],
          };
          localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));

          await deleteAllPatientData(PATIENT_ID, PSYCH);

          const cached = JSON.parse(localStorage.getItem('mock_db_cache') || '{}');
          expect(cached.patients).toHaveLength(0);
          expect(cached.sessions).toHaveLength(1);
          expect(cached.sessions[0].id).toBe('other-session');
          expect(cached.note_versions).toHaveLength(1);
          expect(cached.note_versions[0].sessionId).toBe('other-session');
        });

        it('removes mock_db_cache entirely when empty', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  const legacyCache = {
                    patients: [{ id: PATIENT_ID, name: 'Test' }],
                    sessions: [{ id: s1, patientId: PATIENT_ID }],
                    note_versions: [{ sessionId: s1 }],
                  };
                  localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));

                  await deleteAllPatientData(PATIENT_ID, PSYCH);

                  expect(localStorage.getItem('mock_db_cache')).toBeNull();
                });

                it('logs attachment deletion to audit trail when attachments exist', async () => {
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

                it('handles browser-storage cleanup error gracefully', async () => {
                  await seedPatient();
                  await seedSession();
          
                  // Mock localStorage to throw on getItem
                  const originalGetItem = localStorage.getItem;
                  localStorage.getItem = vi.fn().mockImplementation((key) => {
                    if (key === 'mock_db_cache') {
                      throw new Error('localStorage error');
                    }
                    return originalGetItem.call(localStorage, key);
                  });

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);

                  // Restore
                  localStorage.getItem = originalGetItem;
                });

                it('handles localStorage key() error gracefully', async () => {
                  await seedPatient();
                  await seedSession();
          
                  // Mock localStorage.key to throw
                  const originalKey = localStorage.key;
                  localStorage.key = vi.fn().mockImplementation(() => {
                    throw new Error('key error');
                  });

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);

                  // Restore
                  localStorage.key = originalKey;
                });

                it('handles localStorage removeItem error gracefully', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  localStorage.setItem('draft_edit_' + s1, '{json}');
          
                  // Mock localStorage.removeItem to throw
                  const originalRemoveItem = localStorage.removeItem;
                  localStorage.removeItem = vi.fn().mockImplementation(() => {
                    throw new Error('removeItem error');
                  });

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);

                  // Restore
                  localStorage.removeItem = originalRemoveItem;
                });

                it('handles localStorage setItem error gracefully', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  const legacyCache = {
                    patients: [{ id: PATIENT_ID, name: 'Test' }],
                    sessions: [{ id: s1, patientId: PATIENT_ID }, { id: 'other-session', patientId: 'other' }],
                    note_versions: [{ sessionId: s1 }, { sessionId: 'other-session' }],
                  };
                  localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));
          
                  // Mock localStorage.setItem to throw
                  const originalSetItem = localStorage.setItem;
                  localStorage.setItem = vi.fn().mockImplementation(() => {
                    throw new Error('setItem error');
                  });

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);

                  // Restore
                  localStorage.setItem = originalSetItem;
                });

                it('handles legacy cache with invalid JSON gracefully', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set invalid JSON in legacy cache
                  localStorage.setItem('mock_db_cache', 'invalid json {');

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be removed due to parse error
                  expect(localStorage.getItem('mock_db_cache')).toBeNull();
                });

                it('handles legacy cache with empty object gracefully', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set empty object in legacy cache
                  localStorage.setItem('mock_db_cache', '{}');

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be removed since it's empty after filtering
                  expect(localStorage.getItem('mock_db_cache')).toBeNull();
                });

                it('handles legacy cache with only other patient data', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set legacy cache with only other patient data
                  const legacyCache = {
                    patients: [{ id: 'other-patient', name: 'Other' }],
                    sessions: [{ id: 'other-session', patientId: 'other-patient' }],
                    note_versions: [{ sessionId: 'other-session' }],
                  };
                  localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be preserved since it has other patient data
                  const cached = JSON.parse(localStorage.getItem('mock_db_cache') || '{}');
                  expect(cached.patients).toHaveLength(1);
                  expect(cached.patients[0].id).toBe('other-patient');
                });

                it('handles legacy cache with mixed patient data (some for this patient, some for others)', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set legacy cache with mixed data
                  const legacyCache = {
                    patients: [
                      { id: PATIENT_ID, name: 'Test' },
                      { id: 'other-patient', name: 'Other' }
                    ],
                    sessions: [
                      { id: s1, patientId: PATIENT_ID },
                      { id: 'other-session', patientId: 'other-patient' }
                    ],
                    note_versions: [
                      { sessionId: s1 },
                      { sessionId: 'other-session' }
                    ],
                  };
                  localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be preserved with only other patient data
                  const cached = JSON.parse(localStorage.getItem('mock_db_cache') || '{}');
                  expect(cached.patients).toHaveLength(1);
                  expect(cached.patients[0].id).toBe('other-patient');
                  expect(cached.sessions).toHaveLength(1);
                  expect(cached.sessions[0].id).toBe('other-session');
                  expect(cached.note_versions).toHaveLength(1);
                  expect(cached.note_versions[0].sessionId).toBe('other-session');
                });

                it('handles legacy cache where all data is for this patient (cache removed)', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set legacy cache with only this patient's data
                  const legacyCache = {
                    patients: [{ id: PATIENT_ID, name: 'Test' }],
                    sessions: [{ id: s1, patientId: PATIENT_ID }],
                    note_versions: [{ sessionId: s1 }],
                  };
                  localStorage.setItem('mock_db_cache', JSON.stringify(legacyCache));

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be removed since all data was for this patient
                  expect(localStorage.getItem('mock_db_cache')).toBeNull();
                });

                it('handles legacy cache parse error (cache removed)', async () => {
                  await seedPatient();
                  const s1 = await seedSession();
                  // Set invalid JSON in legacy cache
                  localStorage.setItem('mock_db_cache', 'invalid json {');

                  // Should not throw
                  const result = await deleteAllPatientData(PATIENT_ID, PSYCH);
                  expect(result.patientDeleted).toBe(true);
          
                  // Cache should be removed due to parse error
                  expect(localStorage.getItem('mock_db_cache')).toBeNull();
                });
              });
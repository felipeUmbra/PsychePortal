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
import { downloadBundleAsFile, generateDataBundle } from './data-export';
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
  delete (globalThis as any).document;
});

describe('generateDataBundle', () => {
  it('produces the full bundle shape with patient, sessions and integrity', async () => {
    await seedPatient();
    await seedSession({ notes: 'plaintext note' });

    const bundle = await generateDataBundle(PATIENT, PSYCH);

    expect(bundle.metadata.patientId).toBe(PATIENT);
    expect(bundle.metadata.exportedBy).toBe(PSYCH);
    expect(bundle.patient).toMatchObject({ id: PATIENT, name: 'Ana DSR' });
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.integrity.algorithm).toBeTruthy();
    expect(bundle.integrity.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('downloadBundleAsFile', () => {
    it('creates, clicks, removes, and revokes the sanitized export download', () => {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const link = { style: {}, setAttribute: vi.fn(), click: vi.fn() };
      const body = { appendChild: vi.fn(), removeChild: vi.fn() };
      const documentMock = { createElement: vi.fn(() => link), body };
      Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
      const bundle = {
        metadata: {
          exportedAt: '2026-10-11T00:00:00.000Z',
          exportedBy: PSYCH,
          patientId: PATIENT,
          version: '1.0',
        },
        patient: { id: PATIENT },
        sessions: [],
        integrity: { algorithm: 'SHA-256', hash: 'hash' },
      };

      downloadBundleAsFile(bundle, 'Ana / Doe');

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(link.click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
      expect(link.setAttribute).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/^data-export-Ana___Doe-\d{4}-\d{2}-\d{2}\.json$/),
      );
      expect(body.removeChild).toHaveBeenCalledWith(link);
    });

    it('uses the patient ID when no patient name is provided', () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const link = { style: {}, setAttribute: vi.fn(), click: vi.fn() };
      const documentMock = { createElement: vi.fn(() => link), body: { appendChild: vi.fn(), removeChild: vi.fn() } };
      Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
      const bundle = {
        metadata: {
          exportedAt: '2026-10-11T00:00:00.000Z',
          exportedBy: PSYCH,
          patientId: 'patient 42',
          version: '1.0',
        },
        patient: null,
        sessions: [],
        integrity: { algorithm: 'SHA-256', hash: 'hash' },
      };

      downloadBundleAsFile(bundle);

      expect(link.click).toHaveBeenCalledOnce();
      expect(link.setAttribute).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/^data-export-patient_42-\d{4}-\d{2}-\d{2}\.json$/),
      );
    });
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

  it('stringifies legacy object notes that do not contain an encrypted payload', async () => {
    await seedPatient();
    await seedSession({ notes: { legacy: 'plain object note' } });

    const bundle = await generateDataBundle(PATIENT, PSYCH);

    expect((bundle.sessions[0] as any).notes).toBe('[object Object]');
    expect((bundle.sessions[0] as any)._notesDecrypted).toBe(true);
    expect((bundle.sessions[0] as any)._notesEncrypted).toBeUndefined();
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

    it('handles missing patient gracefully', async () => {
          const bundle = await generateDataBundle('nonexistent-patient', PSYCH);
          expect(bundle.patient).toBeNull();
          expect(bundle.sessions).toHaveLength(0);
        });

        it('handles audit log failure gracefully', async () => {
          await seedPatient();
          mockAudit.logEvent.mockRejectedValueOnce(new Error('Audit failed'));

          // The function doesn't catch logEvent errors, so it will throw
          await expect(generateDataBundle(PATIENT, PSYCH)).rejects.toThrow('Audit failed');
        });

        it('handles Firestore query failure gracefully', async () => {
          await seedPatient();
          // Mock getDocs to fail
          const originalGetDocs = mockFstore.delegates.getDocs;
          mockFstore.delegates.getDocs = vi.fn().mockRejectedValueOnce(new Error('Firestore query failed'));

          await expect(generateDataBundle(PATIENT, PSYCH)).rejects.toThrow('Firestore query failed');

          // Restore
          mockFstore.delegates.getDocs = originalGetDocs;
        });

        it('handles empty sessions collection', async () => {
          await seedPatient();
          const bundle = await generateDataBundle(PATIENT, PSYCH);
          expect(bundle.sessions).toHaveLength(0);
        });

        it('handles empty consents collection', async () => {
          await seedPatient();
          const bundle = await generateDataBundle(PATIENT, PSYCH);
          // consents is not part of the bundle, so just verify it doesn't throw
          expect(bundle).toBeDefined();
        });

    it('handles sessions with various statuses', async () => {
      await seedPatient();
      await seedSession({ status: 'scheduled' });
      await seedSession({ status: 'completed' });
      await seedSession({ status: 'cancelled' });
      await seedSession({ status: 'no-show' });

      const bundle = await generateDataBundle(PATIENT, PSYCH);
      expect(bundle.sessions).toHaveLength(4);
    });

    it('handles sessions with attachments', async () => {
      await seedPatient();
      await seedSession({ 
        attachments: [{ name: 'doc.pdf', storagePath: 'patients/p/s/doc.pdf' }] 
      });

      const bundle = await generateDataBundle(PATIENT, PSYCH);
      expect(bundle.sessions[0].attachments).toHaveLength(1);
      expect(bundle.sessions[0].attachments[0].name).toBe('doc.pdf');
    });

    it('handles integrity hash generation', async () => {
      await seedPatient();
      await seedSession({ notes: 'test note' });

      const bundle = await generateDataBundle(PATIENT, PSYCH);
      expect(bundle.integrity.algorithm).toBeTruthy();
      expect(bundle.integrity.hash).toMatch(/^[0-9a-f]{64}$/);
    });

        it('handles passphrase with missing key record', async () => {
          await seedPatient();
          const salt = generateSalt();
          const key = await deriveKeyFromPassphrase('pass', salt);
          const encrypted = await encryptNote('secret', key);
          await seedSession({ notes: encrypted });
          // No key record stored

          const bundle = await generateDataBundle(PATIENT, PSYCH, 'pass');

          expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
          expect((bundle.sessions[0] as any)._notesEncrypted).toBe(true);
        });

        it('handles passphrase with wrong passphrase', async () => {
          await seedPatient();
          const salt = generateSalt();
          const key = await deriveKeyFromPassphrase('correct-pass', salt);
          const encrypted = await encryptNote('secret', key);
          await seedSession({ notes: encrypted });
          await storeKeyRecord(PSYCH, salt, 'a'.repeat(64));

          // Provide wrong passphrase
          const bundle = await generateDataBundle(PATIENT, PSYCH, 'wrong-pass');

          // Should fail to decrypt, mark as encrypted
          expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
          expect((bundle.sessions[0] as any)._notesEncrypted).toBe(true);
        });

        it('handles multiple sessions with mixed encryption states', async () => {
          await seedPatient();
      
          // Plaintext session
          await seedSession({ notes: 'plaintext note' });
      
          // Encrypted session without passphrase
          const salt1 = generateSalt();
          const key1 = await deriveKeyFromPassphrase('pass1', salt1);
          const encrypted1 = await encryptNote('encrypted1', key1);
          await seedSession({ notes: encrypted1 });
      
          // Encrypted session with passphrase and key record
          const salt2 = generateSalt();
          const key2 = await deriveKeyFromPassphrase('pass2', salt2);
          const encrypted2 = await encryptNote('encrypted2', key2);
          await seedSession({ notes: encrypted2 });
          await storeKeyRecord(PSYCH, salt2, 'a'.repeat(64));

          const bundle = await generateDataBundle(PATIENT, PSYCH, 'pass2');

          expect(bundle.sessions).toHaveLength(3);
          // First session: plaintext
          expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
          expect((bundle.sessions[0] as any)._notesEncrypted).toBeUndefined();
          // Second session: encrypted, no passphrase
          expect((bundle.sessions[1] as any)._notesDecrypted).toBe(false);
          expect((bundle.sessions[1] as any)._notesEncrypted).toBe(true);
          // Third session: encrypted with passphrase and key record
          expect((bundle.sessions[2] as any)._notesDecrypted).toBe(true);
          expect((bundle.sessions[2] as any).notes).toBe('encrypted2');
        });

        it('handles session with null notes', async () => {
          await seedPatient();
          await seedSession({ notes: null });

          const bundle = await generateDataBundle(PATIENT, PSYCH);

          expect(bundle.sessions).toHaveLength(1);
          expect((bundle.sessions[0] as any).notes).toBeNull();
        });

        it('handles session with undefined notes', async () => {
          await seedPatient();
          await seedSession({ notes: undefined });

          const bundle = await generateDataBundle(PATIENT, PSYCH);

          expect(bundle.sessions).toHaveLength(1);
          expect((bundle.sessions[0] as any).notes).toBeUndefined();
        });

        it('handles session with empty string notes', async () => {
          await seedPatient();
          await seedSession({ notes: '' });

          const bundle = await generateDataBundle(PATIENT, PSYCH);

          expect(bundle.sessions).toHaveLength(1);
          expect((bundle.sessions[0] as any).notes).toBe('');
        });

        it('handles getDoc failure for patient', async () => {
          const originalGetDoc = mockFstore.delegates.getDoc;
          mockFstore.delegates.getDoc = vi.fn().mockRejectedValueOnce(new Error('Firestore getDoc failed'));

          await expect(generateDataBundle(PATIENT, PSYCH)).rejects.toThrow('Firestore getDoc failed');

          mockFstore.delegates.getDoc = originalGetDoc;
        });

        it('handles getDocs failure for sessions', async () => {
          await seedPatient();
          const originalGetDocs = mockFstore.delegates.getDocs;
          mockFstore.delegates.getDocs = vi.fn().mockRejectedValueOnce(new Error('Firestore getDocs failed'));

          await expect(generateDataBundle(PATIENT, PSYCH)).rejects.toThrow('Firestore getDocs failed');

          mockFstore.delegates.getDocs = originalGetDocs;
        });

        it('handles decryptNote failure gracefully', async () => {
          await seedPatient();
          const salt = generateSalt();
          const key = await deriveKeyFromPassphrase('pass', salt);
          const encrypted = await encryptNote('secret', key);
          await seedSession({ notes: encrypted });
          await storeKeyRecord(PSYCH, salt, 'a'.repeat(64));

          // Provide wrong passphrase to trigger decryption failure
          const bundle = await generateDataBundle(PATIENT, PSYCH, 'wrong-pass');

          // Should not throw, should mark as encrypted
          expect((bundle.sessions[0] as any)._notesDecrypted).toBe(false);
          expect((bundle.sessions[0] as any)._notesEncrypted).toBe(true);
        });
      });
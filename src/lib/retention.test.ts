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

import * as firestoreMock from './firestore-mock';
import { enforceRetentionPolicy } from './retention';

const OLD_MS = Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000; // ~10 years ago
const RECENT_MS = Date.now() - 1 * 24 * 60 * 60 * 1000; // yesterday

async function boot() {
  mockFstore.delegates = makeDelegates(firestoreMock);
  mockDb.value = firestoreMock.getFirestore();
  firestoreMock.setDriveToken('test-token');
  await new Promise((r) => setTimeout(r, 15));
}

async function seedSession(data: Record<string, unknown>) {
  return (await firestoreMock.addDoc(firestoreMock.collection({}, 'sessions'), data)).id;
}

async function seedConsent(data: Record<string, unknown>) {
  return (await firestoreMock.addDoc(firestoreMock.collection({}, 'patient_consents'), data)).id;
}

async function seedPsychologist(psychId: string) {
  await firestoreMock.setDoc(firestoreMock.doc({}, 'psychologists', psychId), { id: psychId, lastRetentionRun: '' });
}

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
  mockAudit.logDelete.mockClear();
  await boot();
  await cleanAllCollections(firestoreMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enforceRetentionPolicy', () => {
  const PSYCH = 'psych-ret';

  it('deletes expired sessions and updates lastRetentionRun', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({ psychologistId: PSYCH, patientId: 'p-old', date: new Date(OLD_MS).toISOString() });
    await seedSession({ psychologistId: PSYCH, patientId: 'p-new', date: new Date(RECENT_MS).toISOString() });

    const result = await enforceRetentionPolicy(PSYCH, 5);

    expect(result.sessionsDeleted).toBe(1);
    const remaining = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'sessions'), firestoreMock.where('psychologistId', '==', PSYCH))
    )).docs.map((d) => d.data());
    expect(remaining).toHaveLength(1);
    expect(remaining[0].patientId).toBe('p-new');

    const psych = await firestoreMock.getDoc(firestoreMock.doc({}, 'psychologists', PSYCH));
    expect(psych.data().lastRetentionRun).toBeTruthy();
  });

  it('handles ISO-8601 date strings', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({
      psychologistId: PSYCH,
      patientId: 'p-iso',
      date: new Date(OLD_MS).toISOString(),
    });
    const result = await enforceRetentionPolicy(PSYCH, 5);
    expect(result.sessionsDeleted).toBe(1);
  });

  it('deletes orphaned consents when a patient loses all sessions', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({ psychologistId: PSYCH, patientId: 'p-orphan', date: new Date(OLD_MS).toISOString() });
    await seedConsent({ patientId: 'p-orphan' });

    const result = await enforceRetentionPolicy(PSYCH, 5);

    expect(result.sessionsDeleted).toBe(1);
    expect(result.consentsAffected).toBe(1);
    const consents = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'patient_consents'), firestoreMock.where('patientId', '==', 'p-orphan'))
    )).docs;
    expect(consents).toHaveLength(0);
  });

  it('keeps consents when the patient still has a recent session', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({ psychologistId: PSYCH, patientId: 'p-keep', date: new Date(OLD_MS).toISOString() });
    await seedSession({ psychologistId: PSYCH, patientId: 'p-keep', date: new Date(RECENT_MS).toISOString() });
    await seedConsent({ patientId: 'p-keep' });

    const result = await enforceRetentionPolicy(PSYCH, 5);

    expect(result.sessionsDeleted).toBe(1);
    expect(result.consentsAffected).toBe(0);
  });

  it('logs a delete audit event per deleted session (via logDelete)', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({ psychologistId: PSYCH, patientId: 'p-log', date: new Date(OLD_MS).toISOString() });
    await seedSession({ psychologistId: PSYCH, patientId: 'p-log2', date: new Date(OLD_MS).toISOString() });

    const result = await enforceRetentionPolicy(PSYCH, 5);

    expect(result.sessionsDeleted).toBe(2);
    expect(mockAudit.logDelete).toHaveBeenCalledTimes(2);
    const [, , , payload] = mockAudit.logDelete.mock.calls[0];
    expect(payload).toMatchObject({ context: 'retention_policy', retentionYears: 5 });
  });

  it('reports zero deletions when everything is within retention', async () => {
    await seedPsychologist(PSYCH);
    await seedSession({ psychologistId: PSYCH, patientId: 'p-recent', date: new Date(RECENT_MS).toISOString() });

    const result = await enforceRetentionPolicy(PSYCH, 5);
    expect(result.sessionsDeleted).toBe(0);
    expect(result.consentsAffected).toBe(0);
  });
});
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

import * as firestoreMock from './firestore-mock';
import { logDataExport } from './export-log';

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
  await boot();
  await cleanAllCollections(firestoreMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logDataExport', () => {
  it('writes a data_export_logs document with all fields', async () => {
    await logDataExport('psych-1', 'patient-1', 'csv', 7);

    const docs = (await firestoreMock.getDocs(firestoreMock.collection({}, 'data_export_logs'))).docs.map((d) => d.data());
    expect(docs).toHaveLength(1);
    const log = docs[0];
    expect(log.psychologistId).toBe('psych-1');
    expect(log.patientId).toBe('patient-1');
    expect(log.exportType).toBe('csv');
    expect(log.recordCount).toBe(7);
    expect(log.exportedAt).toBeTruthy();
  });

  it('appends multiple entries', async () => {
    await logDataExport('psych-1', 'p1', 'csv', 1);
    await logDataExport('psych-1', 'p2', 'json', 2);
    const docs = (await firestoreMock.getDocs(firestoreMock.collection({}, 'data_export_logs'))).docs.map((d) => d.data());
    expect(docs).toHaveLength(2);
  });

  it('swallows failures (does not throw)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Replace the delegate temporarily to simulate a write failure
    const original = mockFstore.delegates.addDoc;
    mockFstore.delegates.addDoc = async () => { throw new Error('boom'); };
    try {
      await expect(logDataExport('psych-1', 'p1', 'csv', 1)).resolves.not.toThrow();
    } finally {
      mockFstore.delegates.addDoc = original;
      consoleSpy.mockRestore();
    }
  });
});
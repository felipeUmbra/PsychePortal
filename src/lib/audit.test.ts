// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Strategy: audit.ts imports from 'firebase/firestore', which Vite resolves
// to the REAL SDK (package exports win over aliases). To exercise the
// production query engine in-memory, we vi.mock('firebase/firestore') with
// implementations that DELEGATE to the project's firestore-mock.
// We also mock '../firebase' db with a live getter so the module's `db`
// reads the delegating object we build in beforeEach.

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
import { setDriveToken } from './firestore-mock';
import { getLastAuditHash, logEvent, logView, logDelete, verifyAuditChain, logExport, logAuth } from './audit';

async function boot() {
  // Build the delegating firebase/firestore proxy from the real firestore-mock.
  mockFstore.delegates = {
    collection: firestoreMock.collection,
    doc: firestoreMock.doc,
    query: firestoreMock.query,
    where: firestoreMock.where,
    orderBy: firestoreMock.orderBy,
    limit: firestoreMock.limit,
    getDocs: firestoreMock.getDocs,
    getDoc: firestoreMock.getDoc,
    addDoc: firestoreMock.addDoc,
    setDoc: firestoreMock.setDoc,
    updateDoc: firestoreMock.updateDoc,
    deleteDoc: firestoreMock.deleteDoc,
    onSnapshot: firestoreMock.onSnapshot,
    serverTimestamp: firestoreMock.serverTimestamp,
  };
  // db is the firestore-mock "database" - for collection()/doc() the first
  // arg is ignored by the mock, so pass the mock's getFirestore() result.
  mockDb.value = firestoreMock.getFirestore();

  setDriveToken('test-token');
  await new Promise((r) => setTimeout(r, 15));
}

beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
  await boot();
  // Clear state between tests for isolation
  firestoreMock.clearState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getLastAuditHash + Merkle chaining', () => {
  it('returns genesis hash for empty actor', async () => {
    expect(await getLastAuditHash('')).toBe('0'.repeat(64));
  });

  it('returns genesis hash for an actor with no logs', async () => {
    expect(await getLastAuditHash('nobody')).toBe('0'.repeat(64));
  });

  it('chains events per actor and isolates actors (CWE-353 regression)', async () => {
    await logEvent({ actorId: 'psych-2', action: 'create', entity: 'patient', entityId: 'p1' });
    await new Promise((r) => setTimeout(r, 5)); // distinct timestamps keep chain order deterministic
    await logEvent({ actorId: 'psych-3', action: 'delete', entity: 'session', entityId: 's9' });
    await new Promise((r) => setTimeout(r, 5));
    await logEvent({ actorId: 'psych-2', action: 'update', entity: 'patient', entityId: 'p1' });

    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(
        firestoreMock.collection({}, 'audit_logs'),
        firestoreMock.where('actorId', '==', 'psych-2'),
        firestoreMock.orderBy('timestamp', 'asc')
      )
    )).docs.map((d) => d.data());

    expect(docs).toHaveLength(2);
    expect(docs[0].prevHash).toBe('0'.repeat(64));
    expect(docs[1].prevHash).toBe(docs[0].hash);
    expect(docs[1].hash).not.toBe(docs[0].hash);
  });

  it('verifyAuditChain validates a clean chain built by logEvent', async () => {
    for (let i = 0; i < 3; i++) {
      await logEvent({ actorId: 'chain-ok', action: 'update', entity: 'patient', entityId: `p${i}` });
      await new Promise((r) => setTimeout(r, 5)); // unique timestamps -> stable asc order
    }
    const res = await verifyAuditChain('chain-ok');
    expect(res).toEqual({ valid: true, firstInvalidId: undefined, totalRecords: 3 });
  });

  it('verifyAuditChain detects a tampered stored hash', async () => {
    await logEvent({ actorId: 'chain-tamper', action: 'create', entity: 'patient', entityId: 'p1' });
    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'chain-tamper'))
    )).docs.map((d) => d.data());

    expect(docs).toHaveLength(1);
    // Corrupt the stored record via a rewrite with a tampered hash
    const tampered = { ...docs[0], id: 'tampered-id', hash: '0'.repeat(63) + 'f' };
    await firestoreMock.setDoc(firestoreMock.doc({}, 'audit_logs', 'tampered-id'), tampered);

    const res = await verifyAuditChain('chain-tamper');
    expect(res.valid).toBe(false);
  });

  it('verifyAuditChain returns {valid:true, totalRecords:0} when empty', async () => {
    const res = await verifyAuditChain('no-logs');
    expect(res).toEqual({ valid: true, firstInvalidId: undefined, totalRecords: 0 });
  });
});

describe('convenience loggers', () => {
  it('logView / logDelete write events with correct action and hashed beforeData', async () => {
    await logView('psych-v', 'patient', 'p1');
    await logDelete('psych-d', 'session', 's1', { context: 'test' });

    const views = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-v'))
    )).docs.map((d) => d.data());

    const dels = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-d'))
    )).docs.map((d) => d.data());

    expect(views[0].action).toBe('view');
    expect(dels[0].action).toBe('delete');
    expect(dels[0].beforeHash).toBeTruthy();
  });

  it('logExport writes export event with correct action and afterHash', async () => {
    await logExport('psych-export', 'patient', ['p1', 'p2'], 'csv');

    const exports = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-export'))
    )).docs.map((d) => d.data());

    expect(exports).toHaveLength(1);
    expect(exports[0].action).toBe('export');
    expect(exports[0].entity).toBe('patient');
    expect(exports[0].entityId).toBe('p1,p2');
    // afterData is not stored directly; only its hash (afterHash) is stored
    expect(exports[0].afterHash).toBeTruthy();
  });

  it('logAuth writes login/logout events', async () => {
    await logAuth('psych-auth', 'login');
    await logAuth('psych-auth', 'logout');

    const auths = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-auth'))
    )).docs.map((d) => d.data());

    expect(auths).toHaveLength(2);
    expect(auths[0].action).toBe('login');
    expect(auths[1].action).toBe('logout');
    expect(auths[0].entity).toBe('psychologist');
    expect(auths[0].entityId).toBe('psych-auth');
  });
});

describe('audit error handling and edge cases', () => {

  it('handles Firestore addDoc failure in logEvent gracefully (does not throw)', async () => {
    const originalAddDoc = mockFstore.delegates.addDoc;
    mockFstore.delegates.addDoc = vi.fn().mockRejectedValueOnce(new Error('Firestore addDoc failed'));

    // logEvent catches errors internally and doesn't throw
    await expect(logEvent({ actorId: 'test', action: 'create', entity: 'patient', entityId: 'p1' }))
      .resolves.toBeUndefined();

    mockFstore.delegates.addDoc = originalAddDoc;
  });

  it('handles Firestore getDocs failure in getLastAuditHash gracefully (returns genesis hash)', async () => {
    const originalGetDocs = mockFstore.delegates.getDocs;
    mockFstore.delegates.getDocs = vi.fn().mockRejectedValueOnce(new Error('Firestore getDocs failed'));

    // getLastAuditHash catches errors and returns genesis hash
    const result = await getLastAuditHash('test-actor');
    expect(result).toBe('0'.repeat(64));

    mockFstore.delegates.getDocs = originalGetDocs;
  });

  it('handles Firestore getDocs failure in verifyAuditChain gracefully (returns invalid)', async () => {
    const originalGetDocs = mockFstore.delegates.getDocs;
    mockFstore.delegates.getDocs = vi.fn().mockRejectedValueOnce(new Error('Firestore getDocs failed'));

    // verifyAuditChain catches errors and returns invalid result
    const result = await verifyAuditChain('test-actor');
    expect(result.valid).toBe(false);
    expect(result.totalRecords).toBe(0);

    mockFstore.delegates.getDocs = originalGetDocs;
  });

  it('handles empty actorId in logEvent', async () => {
    await logEvent({ actorId: '', action: 'create', entity: 'patient', entityId: 'p1' });
    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', ''))
    )).docs.map((d) => d.data());

    expect(docs).toHaveLength(1);
    expect(docs[0].actorId).toBe('');
  });

  it('handles special characters in entityId', async () => {
    await logEvent({ actorId: 'test', action: 'create', entity: 'patient', entityId: 'p@#$%^&*()' });
    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'test'))
    )).docs.map((d) => d.data());

    expect(docs).toHaveLength(1);
    expect(docs[0].entityId).toBe('p@#$%^&*()');
  });

  it('handles very long entityId', async () => {
    const longId = 'a'.repeat(1000);
    await logEvent({ actorId: 'test', action: 'create', entity: 'patient', entityId: longId });
    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'test'))
    )).docs.map((d) => d.data());

    expect(docs).toHaveLength(1);
    expect(docs[0].entityId).toBe(longId);
  });

  it('handles logExport with empty entityIds array', async () => {
    await logExport('psych-export', 'patient', [], 'csv');
    const exports = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-export'))
    )).docs.map((d) => d.data());

    expect(exports).toHaveLength(1);
    expect(exports[0].entityId).toBe('');
  });

  it('handles logExport with single entityId', async () => {
    await logExport('psych-export', 'patient', ['p1'], 'json');
    const exports = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-export'))
    )).docs.map((d) => d.data());

    expect(exports).toHaveLength(1);
    expect(exports[0].entityId).toBe('p1');
  });

  it('handles logAuth with unknown action', async () => {
    await logAuth('psych-auth', 'unknown-action');
    const auths = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-auth'))
    )).docs.map((d) => d.data());

    expect(auths).toHaveLength(1);
    expect(auths[0].action).toBe('unknown-action');
  });

  it('handles logView with sessionId', async () => {
      await logView('psych-v', 'patient', 'p1', 'session-123');
      const views = (await firestoreMock.getDocs(
        firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-v'))
      )).docs.map((d) => d.data());

      expect(views).toHaveLength(1);
      expect(views[0].action).toBe('view');
      expect(views[0].sessionId).toBe('session-123');
    });

  it('handles logDelete with complex beforeData', async () => {
    const complexData = { 
      nested: { array: [1, 2, 3], obj: { key: 'value' } },
      date: new Date().toISOString(),
      nullValue: null
    };
    await logDelete('psych-d', 'session', 's1', complexData);
    const dels = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'psych-d'))
    )).docs.map((d) => d.data());

    expect(dels).toHaveLength(1);
    expect(dels[0].action).toBe('delete');
    expect(dels[0].beforeHash).toBeTruthy();
  });

  it('handles verifyAuditChain with single record', async () => {
    await logEvent({ actorId: 'single-record', action: 'create', entity: 'patient', entityId: 'p1' });
    const res = await verifyAuditChain('single-record');
    expect(res).toEqual({ valid: true, firstInvalidId: undefined, totalRecords: 1 });
  });

  it('handles verifyAuditChain with missing prevHash', async () => {
    await logEvent({ actorId: 'missing-prev', action: 'create', entity: 'patient', entityId: 'p1' });
    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'missing-prev'))
    )).docs.map((d) => d.data());

    // Corrupt the record by removing prevHash
    const tampered = { ...docs[0], id: 'tampered-id', prevHash: undefined };
    await firestoreMock.setDoc(firestoreMock.doc({}, 'audit_logs', 'tampered-id'), tampered);

    const res = await verifyAuditChain('missing-prev');
    expect(res.valid).toBe(false);
  });

  it('handles verifyAuditChain with mismatched hash', async () => {
    await logEvent({ actorId: 'mismatch-hash', action: 'create', entity: 'patient', entityId: 'p1' });
    await new Promise((r) => setTimeout(r, 5));
    await logEvent({ actorId: 'mismatch-hash', action: 'update', entity: 'patient', entityId: 'p1' });

    const docs = (await firestoreMock.getDocs(
      firestoreMock.query(firestoreMock.collection({}, 'audit_logs'), firestoreMock.where('actorId', '==', 'mismatch-hash'))
    )).docs.map((d) => d.data());

    // Corrupt the second record's hash
    const tampered = { ...docs[1], id: 'tampered-id', hash: '0'.repeat(63) + 'f' };
    await firestoreMock.setDoc(firestoreMock.doc({}, 'audit_logs', 'tampered-id'), tampered);

    const res = await verifyAuditChain('mismatch-hash');
    expect(res.valid).toBe(false);
  });
});
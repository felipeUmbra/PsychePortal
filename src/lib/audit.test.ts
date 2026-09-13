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
import { getLastAuditHash, logEvent, logView, logDelete, verifyAuditChain } from './audit';

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
});
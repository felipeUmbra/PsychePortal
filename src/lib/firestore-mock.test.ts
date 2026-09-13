// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// firestore-mock keeps module-level state, so each test re-imports it after
// vi.resetModules() for a clean start. A Drive token + mocked fetch make the
// load loop settle (isLoaded=true) so writes are not queued.

async function freshMock() {
  vi.resetModules();
  const mod = await import('./firestore-mock');
  return mod;
}

async function bootMock() {
  const mod = await freshMock();
  mod.setDriveToken('test-token');
  // Wait for the mocked Drive load to complete
  await new Promise((r) => setTimeout(r, 15));
  return mod;
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ files: [] }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('firestore-mock building blocks', () => {
  it('collection builds a path ref', async () => {
    const { collection } = await freshMock();
    expect(collection({}, 'patients')).toEqual({ type: 'collection', path: 'patients' });
  });

  it('doc supports (colRef, id) and (db, path) overloads', async () => {
    const { doc, collection } = await freshMock();
    const col = collection({}, 'sessions');
    expect(doc(col, 'abc')).toEqual({ type: 'doc', path: 'sessions', id: 'abc' });
    const d = doc({}, 'patients/p-1');
    expect(d.type).toBe('doc');
    expect(d.path).toBe('patients');
    expect(d.id).toBe('p-1');
    const auto = doc({}, 'patients');
    expect(auto.id).toBeTruthy();
  });

  it('query/where/orderBy/limit build condition descriptors', async () => {
    const { query, where, orderBy, limit, collection } = await freshMock();
    const q = query(collection({}, 'sessions'), where('patientId', '==', 'p1'), orderBy('date', 'desc'), limit(5));
    expect(q.conditions[0]).toEqual({ type: 'where', field: 'patientId', op: '==', val: 'p1' });
    expect(q.conditions[1]).toEqual({ type: 'orderBy', field: 'date', dir: 'desc' });
    expect(q.conditions[2]).toEqual({ type: 'limit', num: 5 });
  });
});

describe('firestore-mock CRUD (memory-only, no Drive)', () => {
  it('addDoc creates a doc with an id and getDoc retrieves it', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    const docRef = await mod.addDoc(col, { name: 'Ana', psychologistId: 'u1' });
    expect(docRef.id).toBeTruthy();

    const snap = await mod.getDoc(mod.doc({}, 'patients', docRef.id));
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toMatchObject({ name: 'Ana', psychologistId: 'u1' });
    expect(snap.data().id).toBeUndefined(); // id stripped like real Firestore
  });

  it('getDocs filters with where conditions', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    await mod.addDoc(col, { name: 'Ana', psychologistId: 'u1' });
    await mod.addDoc(col, { name: 'Bia', psychologistId: 'u2' });

    const snap = await mod.getDocs(mod.query(col, mod.where('psychologistId', '==', 'u1')));
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data().name).toBe('Ana');
  });

  it('updateDoc merges fields', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    const ref = await mod.addDoc(col, { name: 'Ana', age: 30 });
    await mod.updateDoc(mod.doc({}, 'patients', ref.id), { age: 31 });

    const snap = await mod.getDoc(mod.doc({}, 'patients', ref.id));
    expect(snap.data()).toMatchObject({ name: 'Ana', age: 31 });
  });

  it('deleteDoc removes the document and getDocs reflects it', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'sessions');
    const r1 = await mod.addDoc(col, { patientId: 'p1' });
    const r2 = await mod.addDoc(col, { patientId: 'p1' });
    await mod.deleteDoc(mod.doc({}, 'sessions', r1.id));

    const snap = await mod.getDocs(mod.query(col, mod.where('patientId', '==', 'p1')));
    expect(snap.size).toBe(1);
    expect(snap.docs[0].id).toBe(r2.id);
  });

  it('DocSnapshot.data() returns a deep clone (mutation-safe)', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    const ref = await mod.addDoc(col, { name: 'Ana', nested: { ok: true }, arr: [1] });
    const snap = await mod.getDoc(mod.doc({}, 'patients', ref.id));

    const data = snap.data();
    data.name = 'MUTATED';
    data.arr.push(999);

    const snap2 = await mod.getDoc(mod.doc({}, 'patients', ref.id));
    expect(snap2.data().name).toBe('Ana');
    expect(snap2.data().arr).toEqual([1]);
  });

  it('onSnapshot emits an initial snapshot and updates on writes', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    await mod.addDoc(col, { name: 'Ana' });

    const sizes: number[] = [];
    const unsub = mod.onSnapshot(col, (snap: any) => sizes.push(snap.size));
    await new Promise((r) => setTimeout(r, 15));

    await mod.addDoc(col, { name: 'Bia' });
    await new Promise((r) => setTimeout(r, 15));

    expect(sizes.length).toBeGreaterThanOrEqual(2);
    expect(sizes[sizes.length - 1]).toBe(2);
    unsub();
  });

  it('serverTimestamp is processed into an ISO string on write', async () => {
    const mod = await bootMock();
    const col = mod.collection({}, 'patients');
    const ref = await mod.addDoc(col, { name: 'Ana', createdAt: mod.serverTimestamp() });
    const snap = await mod.getDoc(mod.doc({}, 'patients', ref.id));
    expect(typeof snap.data().createdAt).toBe('string');
  });
});
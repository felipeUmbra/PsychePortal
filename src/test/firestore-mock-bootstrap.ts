// Shared test helpers for firestore-mock-backed unit tests.
// firestore-mock keeps module-level state with no exported reset, so tests
// clean each collection through the public CRUD API (deterministic and uses
// only real behavior).

const KNOWN_COLLECTIONS = [
  'patients',
  'sessions',
  'psychologists',
  'audit_logs',
  'patient_consents',
  'note_versions',
  'data_export_logs',
] as const;

/**
 * Deletes every document from every KNOWN_COLLECTION so each test starts
 * from an empty in-memory Firestore.
 */
export async function cleanAllCollections(firestore: any) {
  for (const colName of KNOWN_COLLECTIONS) {
    const col = firestore.collection({}, colName);
    const snap = await firestore.getDocs(col);
    for (const d of snap.docs) {
      await firestore.deleteDoc(firestore.doc({}, colName, d.id));
    }
  }
}

/** Build a delegates object that maps 'firebase/firestore' names to a firestore-mock. */
export function makeDelegates(firestore: any): Record<string, any> {
  return {
    collection: firestore.collection,
    doc: firestore.doc,
    query: firestore.query,
    where: firestore.where,
    orderBy: firestore.orderBy,
    limit: firestore.limit,
    getDocs: firestore.getDocs,
    getDoc: firestore.getDoc,
    addDoc: firestore.addDoc,
    setDoc: firestore.setDoc,
    updateDoc: firestore.updateDoc,
    deleteDoc: firestore.deleteDoc,
    onSnapshot: firestore.onSnapshot,
    serverTimestamp: firestore.serverTimestamp,
  };
}
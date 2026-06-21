/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Note versioning — snapshots of session notes stored in the
 * note_versions Firestore collection before each update.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteVersion {
  id: string;
  sessionId: string;
  psychologistId: string;
  notes: string;       // encrypted blob (same AES-GCM JSON as session notes)
  version: number;
  createdAt: string;   // ISO 8601
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getLatestVersionNumber(
  sessionId: string,
  psychologistId: string,
): Promise<number> {
  const q = query(
    collection(db, 'note_versions'),
    where('sessionId', '==', sessionId),
    where('psychologistId', '==', psychologistId),
    orderBy('version', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return (snap.docs[0].data() as Omit<NoteVersion, 'id'>).version;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Saves a snapshot of the current notes to the note_versions collection.
 * Returns the new document ID.
 */
export async function saveNoteVersion(
  sessionId: string,
  psychologistId: string,
  notes: string,
  version: number,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'note_versions'), {
    sessionId,
    psychologistId,
    notes,
    version,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Convenience: resolves the next version number and saves in one call.
 * Returns the new document ID.
 */
export async function saveNextNoteVersion(
  sessionId: string,
  psychologistId: string,
  notes: string,
): Promise<string> {
  const next = (await getLatestVersionNumber(sessionId, psychologistId)) + 1;
  return saveNoteVersion(sessionId, psychologistId, notes, next);
}

/**
 * Retrieves the full version history for a session, newest first.
 */
export async function getNoteVersions(
  sessionId: string,
  psychologistId: string,
): Promise<NoteVersion[]> {
  const q = query(
    collection(db, 'note_versions'),
    where('sessionId', '==', sessionId),
    where('psychologistId', '==', psychologistId),
    orderBy('version', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NoteVersion));
}

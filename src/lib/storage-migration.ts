/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Storage Path Migration Utility
 * Migrates attachments from old path (sessions/{sessionId}/) to new path
 * (patients/{psychologistId}/{sessionId}/) for CFP 09/2024 compliance.
 */

import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from './firestore-mock';

export interface MigrationResult {
  sessionsScanned: number;
  attachmentsMigrated: number;
  errors: string[];
}

export async function migrateAttachmentPaths(psychologistId: string): Promise<MigrationResult> {
  const result: MigrationResult = { sessionsScanned: 0, attachmentsMigrated: 0, errors: [] };

  const sessionsSnap = await getDocs(
    query(collection(db, 'sessions'), where('psychologistId', '==', psychologistId))
  );

  for (const sessionDoc of sessionsSnap.docs) {
    result.sessionsScanned++;
    const sessionData = sessionDoc.data() as any;
    const attachments = sessionData.attachments || [];

    if (attachments.length === 0) continue;

    let modified = false;
    const updatedAttachments = [...attachments];

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      if (att.storagePath) continue; // already migrated

      const oldPath = `sessions/${sessionDoc.id}/${att.name}`;
      const newPath = `patients/${psychologistId}/${sessionDoc.id}/${att.name}`;

      try {
        // 1. Try to get the download URL from old path
        const oldRef = { type: 'storage-ref' as const, path: oldPath };
        const url = await getDownloadURL(oldRef);
        if (url === '#error-fetching-file') throw new Error('File not found at old path');

        // 2. Fetch the blob data
        const response = await fetch(url);
        const blob = await response.blob();

        // 3. Upload to new path
        const newRef = ref(getStorage(), newPath);
        await uploadBytes(newRef, blob);
        const newUrl = await getDownloadURL(newRef);

        // 4. Delete old file
        await deleteObject({ path: oldPath });

        // 5. Update metadata
        updatedAttachments[i] = { ...att, url: newUrl, storagePath: newPath };
        modified = true;
        result.attachmentsMigrated++;
      } catch (err: any) {
        result.errors.push(`Session ${sessionDoc.id}, file ${att.name}: ${err.message}`);
      }
    }

    if (modified) {
      await updateDoc(doc(db, 'sessions', sessionDoc.id), {
        attachments: updatedAttachments,
      });
    }
  }

  return result;
}

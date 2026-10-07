/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retention Policy Enforcement module.
 * Deletes sessions older than the configured retention period for a psychologist.
 * Every deletion is logged to the tamper-evident audit trail.
 */

import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logDelete } from './audit';

export interface RetentionResult {
  sessionsDeleted: number;
  executedAt: string;
}

/**
 * Enforces the data retention policy for a given psychologist.
 * Queries sessions older than `retentionYears`, deletes them,
 * logs each deletion to the audit trail, and updates the psychologist's
 * lastRetentionRun timestamp.
 *
 * @param psychologistId - The psychologist's UID
 * @param retentionYears - Number of years to retain session data
 * @returns A summary of the enforcement result
 */
export async function enforceRetentionPolicy(
  psychologistId: string,
  retentionYears: number
): Promise<RetentionResult> {
  const result: RetentionResult = {
    sessionsDeleted: 0,
    executedAt: new Date().toISOString(),
  };

  // Compute cutoff date
  const now = Date.now();
  const cutoffMs = now - retentionYears * 365.25 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs);

  // 1. Query all sessions for this psychologist
  const sessionsSnap = await getDocs(
    query(collection(db, 'sessions'), where('psychologistId', '==', psychologistId))
  );

  // 2. Filter sessions older than the cutoff
  const expiredSessions = sessionsSnap.docs.filter((d) => {
    const data = d.data();
    const sessionDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
    return sessionDate.getTime() < cutoffMs;
  });

  // 3. Delete expired sessions and log to audit trail
  for (const sessionDoc of expiredSessions) {
    try {
      const data = sessionDoc.data();
      await deleteDoc(doc(db, 'sessions', sessionDoc.id));
      await logDelete(psychologistId, 'session', sessionDoc.id, {
        context: 'retention_policy',
        retentionYears,
        sessionDate: data.date,
      });
      result.sessionsDeleted++;
    } catch (err) {
      console.error(`Failed to delete session ${sessionDoc.id} during retention enforcement:`, err);
    }
  }

  // 4. Update the psychologist's lastRetentionRun timestamp
  try {
    await updateDoc(doc(db, 'psychologists', psychologistId), {
      lastRetentionRun: result.executedAt,
    });
  } catch (err) {
    console.error('Failed to update lastRetentionRun:', err);
  }

  return result;
}
